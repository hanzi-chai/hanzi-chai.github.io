import { bisectLeft, bisectRight } from "d3-array";
import { isEqual, range } from "lodash-es";
import { 区间, 拓扑, 笔画图形 } from "./bezier.js";
import type { 分类器, 笔画名称 } from "./classifier.js";
import type { 退化配置 } from "./config.js";
import type { 矢量图形数据, 结构描述字符 } from "./data.js";
import { 二笔字根, 单笔字根, 获取注册表 } from "./main.js";
import { 排序, 是共线, 是小于 } from "./math.js";
import type {
  基本分析,
  基本部件分析,
  字形分析配置,
  字根,
} from "./repertoire.js";
import {
  type 拆分方式,
  type 拆分环境,
  type 筛选器,
  默认筛选器列表,
} from "./selector.js";
import type { 字符 } from "./unicode.js";
import { default_err, ok, type Result, type 源标签集合 } from "./utils.js";

export const 默认退化配置: 退化配置 = {
  feature: {
    提: "横",
    捺: "点",
  } as Record<笔画名称, 笔画名称>,
  no_cross: false,
};

const 笔画名称等价 = (退化器: 退化配置, s1: 笔画名称, s2: 笔画名称) => {
  const 合并 = 退化器.feature ?? ({} as Record<笔画名称, 笔画名称>);
  const d1 = 合并[s1] ?? s1;
  const d2 = 合并[s2] ?? s2;
  return d1 === d2;
};

/**
 * 计算后的部件
 *
 * 在基本部件 BasicComponent 的基础上，将 SVG 命令转换为参数曲线
 * 再基于参数曲线计算拓扑
 */
class 部件 implements 字根 {
  private 笔画列表: 笔画图形[];
  private 拓扑: 拓扑;

  constructor(
    public 字符: 字符,
    public 标签集合: 源标签集合,
    public 矢量图形: 矢量图形数据,
  ) {
    this.笔画列表 = 矢量图形.map((x) => new 笔画图形(x));
    this.拓扑 = new 拓扑(this.笔画列表);
  }

  _笔画列表() {
    return this.笔画列表;
  }

  _拓扑() {
    return this.拓扑;
  }

  获取名称() {
    return this.字符.toString();
  }

  笔画数() {
    return this.笔画列表.length;
  }

  获取笔画序列(classifier: 分类器) {
    return this.笔画列表.map((stroke) => classifier[stroke.feature]);
  }

  查询拓扑关系(i: number, j: number) {
    if (i <= j) {
      return this.拓扑.matrix[j]?.[i];
    } else {
      return this.拓扑.matrix[i]?.[j];
    }
  }

  具有同向笔画(i: number, j: number) {
    const [smaller, larger] = 排序(i, j);
    return this.拓扑.orientedPairs.some((x) => isEqual(x, [larger, smaller]));
  }

  /**
   * 给定一个部件和一个字根，找出这个部件所有包含这个字根的方式
   * 如果部件不包含这个字根，就返回空列表
   *
   * @param root - 字根
   * @param degenerator - 退化器
   */
  生成二进制切片列表(root: 部件, degenerator: 退化配置) {
    const { 笔画列表: cglyph, 拓扑: ctopology } = this;
    const { 笔画列表: rglyph, 拓扑: rtopology } = root;
    if (cglyph.length < rglyph.length) return [];
    let queue = [[]] as number[][];
    for (const [rIndex, rStroke] of rglyph.entries()) {
      const rStrokeTopology = rtopology.matrix[rIndex]?.slice(0, rIndex);
      const end = cglyph.length - rglyph.length + rIndex + 1;
      for (let _ = queue.length; _ !== 0; --_) {
        const indexList = queue.shift()!;
        const start = indexList.length ? indexList.at(-1)! + 1 : 0;
        for (const [cIndex, cStroke] of cglyph.slice(start, end).entries()) {
          if (!笔画名称等价(degenerator, cStroke.feature, rStroke.feature))
            continue;
          const realIndex = cIndex + start;
          const cStrokeTopology = ctopology.matrix[realIndex]?.filter((_, i) =>
            indexList.includes(i),
          );
          if (!isEqual(cStrokeTopology, rStrokeTopology)) continue;
          queue.push(indexList.concat(realIndex));
        }
      }
      if (!queue) return [];
    }
    if (degenerator.no_cross) {
      const allindices = [...Array(cglyph.length).keys()];
      queue = queue.filter((indices) => {
        const others = allindices.filter((x) => !indices.includes(x));
        const allCombinations = indices.flatMap((x) =>
          others.map((y) => 排序(x, y)),
        );
        return allCombinations.every(([x, y]) => {
          const relation = ctopology.matrix[y]![x]!;
          return relation.every((cr) => cr.type !== "交");
        });
      });
    }
    return queue
      .filter((x) => this.验证特殊字根(root, x))
      .map(this.索引转二进制.bind(this));
  }

  /**
   * 根据一个部件中包含的所有字根的情况，导出所有可能的拆分方案
   *
   * @param 全部字根二进制列表 - 部件包含的字根列表，其中每个字根用二进制表示
   * @param 必要字根二进制集合 - 部件必须包含的字根列表，其中每个字根用二进制表示
   * @param 二进制字根映射 - 从二进制表示到字根名称的映射
   *
   * 函数通过递归的方式，每次选取剩余部分的第一笔，然后在字根列表中找到包含这个笔画的所有字根
   * 将这些可能性与此前已经拆分的部分组合，得到新的拆分方案
   * 直到所有的笔画都使用完毕
   */
  生成拆分列表(
    全部字根二进制列表: number[],
    必要字根二进制集合: Set<number>,
    二进制字根映射: Map<number, 字根>,
  ) {
    const 拆分方式列表: 拆分方式[] = [];
    const 全部二进制 = (1 << this.笔画数()) - 1;
    const 区间和 = this.生成区间和(必要字根二进制集合);
    const 寻找下一个字根 = (
      部分和: number,
      拆分方式: number[],
      逆向累积和: number[],
    ) => {
      const 剩余和 = 全部二进制 - 部分和;
      const 剩余部分第一笔 = 1 << (31 - Math.clz32(剩余和));
      const 起始 = bisectLeft(全部字根二进制列表, 剩余部分第一笔);
      const 终止 = bisectRight(全部字根二进制列表, 剩余和);
      for (const 字根 of 全部字根二进制列表.slice(起始, 终止)) {
        if ((部分和 & 字根) !== 0) continue;
        const 新部分和 = 部分和 + 字根;
        const 新逆向累积和 = 逆向累积和.map((x) => x + 字根);
        const 新拆分方式 = 拆分方式.concat(字根);
        if (新逆向累积和.some((x) => 区间和.has(x))) {
          continue;
        }
        新逆向累积和.push(字根);
        if (新部分和 === 全部二进制) {
          const res = 新拆分方式.map((v) => ({
            字根: 二进制字根映射.get(v)!,
            笔画索引: this.二进制转索引(v),
            笔画二进制表示: v,
          }));
          拆分方式列表.push(res);
        } else {
          寻找下一个字根(新部分和, 新拆分方式, 新逆向累积和);
        }
      }
    };
    寻找下一个字根(0, [], []);
    return 拆分方式列表;
  }

  生成区间和(字根集合: Set<number>) {
    const strokes = this.笔画数();
    const array = range(strokes)
      .map((x) => 1 << x)
      .reverse();
    const intervalSums = new Set<number>();
    for (let start = 0; start !== strokes - 1; ++start) {
      let sum = array[start]!;
      for (let end = start + 1; end !== strokes; ++end) {
        sum += array[end]!;
        if (字根集合.has(sum)) {
          intervalSums.add(sum);
        }
      }
    }
    return intervalSums;
  }

  索引转二进制(indices: number[]) {
    const n = this.笔画数();
    let binaryCode = 0;
    for (const index of indices) {
      binaryCode += 1 << (n - index - 1);
    }
    return binaryCode;
  }

  二进制转索引(binary: number) {
    const n = this.笔画数();
    const indices = [...Array(n).keys()];
    return indices.filter((index) => binary & (1 << (n - index - 1)));
  }

  /**
   * 对于一些特殊的字根，一般性的字根认同规则可能不足以区分它们，需要特殊处理
   * 这里判断了待拆分部件中的某些笔画究竟是不是这个字根
   *
   * @param root - 字根
   * @param indices - 笔画索引列表
   */
  验证特殊字根(root: 部件, indices: number[]) {
    const s = root.字符.toString();
    if (["土", "士"].includes(s)) {
      const [i1, _, i3] = indices as [number, number, number];
      const upperHeng = this.笔画列表[i1]!.curveList[0]!;
      const lowerHeng = this.笔画列表[i3]!.curveList[0]!;
      const lowerIsLonger = upperHeng.长度() < lowerHeng.长度();
      return s === "土" ? lowerIsLonger : !lowerIsLonger;
    }
    if (["未", "末"].includes(s)) {
      const [i1, i2] = indices as [number, number];
      const upperHeng = this.笔画列表[i1]!.curveList[0]!;
      const lowerHeng = this.笔画列表[i2]!.curveList[0]!;
      const lowerIsLonger = upperHeng.长度() < lowerHeng.长度();
      return s === "未" ? lowerIsLonger : !lowerIsLonger;
    }
    if (["口", "囗"].includes(s)) {
      if (["囗", "\ue02d"].includes(this.字符.toString())) {
        return s === "囗";
      }
      const [i1, _, i3] = indices as [number, number, number];
      const upperLeft = this.笔画列表[i1]!.curveList[0]!.求值(0);
      const lowerRight = this.笔画列表[i3]!.curveList[0]!.求值(1);
      const xrange = new 区间(upperLeft[0], lowerRight[0]);
      const yrange = new 区间(upperLeft[1], lowerRight[1]);
      const otherStrokes = this.笔画列表.filter(
        (_, index) => !indices.includes(index),
      );
      const containsStroke = otherStrokes.some((stroke) =>
        stroke.isBoundedBy(xrange, yrange),
      );
      return s === "囗" ? containsStroke : !containsStroke;
    }
    if (["\ue087" /* 木无十 */, "\ue43d" /* 全字头 */].includes(s)) {
      const [i1] = indices as [number];
      const attachPoint = this.笔画列表[i1]!.curveList[0]!.求值(0);
      const otherStrokes = this.笔画列表.filter(
        (_, index) => !indices.includes(index),
      );
      const otherCurves = otherStrokes.flatMap((s) => s.curveList);
      const pieAndNaIsSeparated = otherCurves.some(
        (x) =>
          x.获取类型() === "linear" &&
          是共线(x.求值(0), x.求值(1), attachPoint),
      );
      return s === "\ue087" ? pieAndNaIsSeparated : !pieAndNaIsSeparated;
    }
    return true;
  }

  生成二进制字根映射(字根部件列表: 部件[], 退化配置: 退化配置, 分类器: 分类器) {
    const 二进制字根映射 = new Map<number, 字根>(
      this.笔画列表.map((stroke, index) => {
        const 二进制数 = 1 << (this.笔画数() - 1 - index);
        return [二进制数, 单笔字根.创建(分类器[stroke.feature])];
      }),
    );
    for (const 字根部件 of 字根部件列表) {
      const 二进制列表 = this.生成二进制切片列表(字根部件, 退化配置);
      二进制列表.map((二进制数) => 二进制字根映射.set(二进制数, 字根部件));
    }
    return 二进制字根映射;
  }

  /**
   * 通过自动拆分算法，给定字根列表，对部件进行拆分
   * 如果拆分唯一，则返回拆分结果；否则返回错误
   *
   * @param 配置 - 拆分配置
   *
   * @returns 拆分结果或错误
   */
  给出部件分析(配置: 字形分析配置): Result<默认部件分析, Error> {
    const 当前字根 = new Set(配置.字根决策.keys());
    const 必要字根 = 当前字根.difference(配置.可选字根);
    const 退化配置 = 配置.分析配置?.degenerator ?? 默认退化配置;
    const 二进制字根映射 = this.生成二进制字根映射(
      配置.部件字根列表,
      退化配置,
      配置.分类器,
    );
    const 字根笔画索引映射 = new Map<字根, number[][]>();
    for (const [二进制数, 字根] of 二进制字根映射) {
      const 索引 = this.二进制转索引(二进制数);
      if (索引.length === 1) continue;
      if (!字根笔画索引映射.has(字根)) 字根笔画索引映射.set(字根, [索引]);
      else 字根笔画索引映射.get(字根)!.push(索引);
    }
    const 字根二进制列表 = Array.from(二进制字根映射.keys()).sort(
      (a, b) => a - b,
    );
    const 必要字根二进制集合: Set<number> = new Set();
    for (const [二进制数, 字根] of 二进制字根映射) {
      if (必要字根.has(字根)) 必要字根二进制集合.add(二进制数);
    }
    const 拆分方式列表 = this.生成拆分列表(
      字根二进制列表,
      必要字根二进制集合,
      二进制字根映射,
    );
    const 全部拆分方式 = this.选择(
      配置,
      拆分方式列表,
      二进制字根映射,
      必要字根,
    );
    const 当前拆分方式 = 全部拆分方式.find((x) =>
      x.拆分方式.every((y) => 当前字根.has(y.字根)),
    )!;
    if (当前拆分方式 === undefined) {
      return default_err("无法找到符合当前字根集合的拆分方式");
    }
    const 字根序列 = 当前拆分方式.拆分方式.map((x) => x.字根);
    return ok({
      类型: "部件" as const,
      字根序列,
      部件图形: this,
      字根笔画映射: 字根笔画索引映射,
      当前拆分方式,
      全部拆分方式,
    });
  }

  /**
   * 选择最优的拆分方案
   *
   * @param 配置 - 配置
   * @param 拆分方式列表 - 拆分方案列表
   * @param 二进制字根映射 - 字根映射，从切片的二进制表示到字根名称的映射
   */
  选择(
    配置: 字形分析配置,
    拆分方式列表: 拆分方式[],
    二进制字根映射: Map<number, 字根>,
    必要字根: Set<字根>,
  ): 拆分方式与评价[] {
    const environment: 拆分环境 = {
      部件图形: this,
      二进制字根映射,
      ...配置,
    };
    const 筛选器列表: [string, 筛选器][] = [];
    for (const name of 配置.分析配置.selector ?? 默认筛选器列表) {
      const 筛选器 = 获取注册表().创建筛选器(name);
      if (筛选器) {
        筛选器列表.push([name, 筛选器]);
      }
    }
    const 拆分方式与评价列表 = 拆分方式列表.map((拆分方式) => {
      const 评价: Map<string, number[]> = new Map();
      for (const [name, 筛选器] of 筛选器列表) {
        const 取值 = 筛选器.评价(拆分方式, environment);
        评价.set(name, 取值);
      }
      return { 拆分方式, 评价, 可用: false };
    });
    拆分方式与评价列表.sort((a, b) => {
      for (const [name, _] of 筛选器列表) {
        const aValue = a.评价.get(name)!;
        const bValue = b.评价.get(name)!;
        if (是小于(aValue, bValue)) return -1;
        if (是小于(bValue, aValue)) return 1;
      }
      return 0;
    });
    const 包含可选字根列表 = 拆分方式与评价列表.map((x) =>
      x.拆分方式.map((y) => y.字根).filter((y) => !必要字根.has(y)),
    );
    for (const [index, 拆分方式与评价] of 拆分方式与评价列表.entries()) {
      拆分方式与评价.可用 = true;
      for (let prevIndex = 0; prevIndex !== index; ++prevIndex) {
        const current = 包含可选字根列表[index]!;
        const previous = 包含可选字根列表[prevIndex]!;
        if (previous.every((x) => current.includes(x))) {
          拆分方式与评价.可用 = false;
          break;
        }
      }
      if (拆分方式与评价.拆分方式.every((x) => 必要字根.has(x.字根))) {
        break;
      }
    }
    return 拆分方式与评价列表;
  }
}

interface 拆分方式与评价 {
  拆分方式: 拆分方式;
  评价: Map<string, number[]>;
  可用: boolean;
}

abstract class 部件分析器<部件分析 extends 基本部件分析 = 基本部件分析> {
  /**
   * 分析部件并返回分析结果
   */
  分析(_: 部件): Result<部件分析, Error> {
    return default_err("分析未实现");
  }

  /**
   * 动态分析部件并返回分析结果组
   */
  动态分析(_: 部件): Result<部件分析[], Error> {
    return default_err("动态分析未实现");
  }
}

/**
 * 部件通过自动拆分算法分析得到的拆分结果的全部细节
 */
interface 默认部件分析 extends 基本部件分析 {
  部件图形: 部件;
  字根笔画映射: Map<字根, number[][]>;
  当前拆分方式: 拆分方式与评价;
  全部拆分方式: 拆分方式与评价[];
  // 用于存储因为自定义而被覆盖的拆分方式
  被覆盖拆分方式?: 拆分方式与评价;
}

class 默认部件分析器 extends 部件分析器<默认部件分析> {
  static readonly type = "默认";
  constructor(private 配置: 字形分析配置) {
    super();
  }

  分析(部件: 部件) {
    const 分析 = 部件.给出部件分析(this.配置);
    if (!分析.ok) return 分析;
    return ok(定制化分析(部件.字符, 分析.value, this.配置));
  }

  动态分析(部件: 部件) {
    const 分析 = 部件.给出部件分析(this.配置);
    if (!分析.ok) return 分析;
    const 基本分析 = 分析.value;
    const 结果列表 = 基本分析.全部拆分方式
      .filter((x) => x.可用)
      .map((x) => {
        return {
          ...基本分析,
          当前拆分方式: x,
          字根序列: x.拆分方式.map((y) => y.字根),
        };
      });
    return ok(动态定制化分析(部件.字符, 结果列表, this.配置));
  }
}

class 二笔部件分析器 extends 部件分析器<基本部件分析> {
  static readonly type = "二笔";
  constructor(private 配置: 字形分析配置) {
    super();
  }

  前两笔和末笔(部件: 部件) {
    const 笔画列表 = 部件.获取笔画序列(this.配置.分类器);
    const [第一笔, 第二笔] = 笔画列表;
    if (!第一笔) return default_err("部件没有笔画，无法进行二笔分析");
    const 字根序列: 字根[] = [二笔字根.创建(第一笔, 第二笔 ?? 0)];
    if (笔画列表.length > 2) {
      const 末笔 = 笔画列表.at(-1)!;
      字根序列.push(单笔字根.创建(末笔));
    }
    return ok(字根序列);
  }

  分析(部件: 部件) {
    const 结果: 基本部件分析 = { 类型: "部件", 字根序列: [] };
    if (this.配置.字根决策.has(部件)) {
      结果.字根序列.push(部件);
      return ok(结果);
    } else {
      const 前两笔和末笔 = this.前两笔和末笔(部件);
      if (!前两笔和末笔.ok) return 前两笔和末笔;
      结果.字根序列 = 前两笔和末笔.value;
      return ok(结果);
    }
  }

  动态分析(部件: 部件) {
    const 结果列表: 基本部件分析[] = [];
    if (this.配置.字根决策.has(部件) || this.配置.可选字根.has(部件)) {
      结果列表.push({ 类型: "部件", 字根序列: [部件] });
    }
    const 是必要字根 =
      this.配置.字根决策.has(部件) && !this.配置.可选字根.has(部件);
    if (!是必要字根) {
      const 前两笔和末笔 = this.前两笔和末笔(部件);
      if (!前两笔和末笔.ok) return 前两笔和末笔;
      结果列表.push({ 类型: "部件", 字根序列: 前两笔和末笔.value });
    }
    return ok(结果列表);
  }
}

function 计算张码补码(字根序列: 字根[], 分类器: 分类器, 结构符?: 结构描述字符) {
  // 在补码时，竖钩视为竖，横折弯钩视为折
  const coalesce = [0, 1, 2, 3, 4, 5, 2, 5];
  const first = 字根序列[0]!.获取笔画序列(分类器);
  const last = 字根序列[字根序列.length - 1]!.获取笔画序列(分类器);
  const firstfirst = coalesce[first[0]!]!;
  const lastlast = coalesce[last.at(-1)!]!;
  // 单笔画补码用 61 表示
  if (字根序列.length === 1 && first.length === 1) {
    return "61";
  }
  // 并型和左下围，首 + 末
  // 其他情况，末 + 首
  if (结构符 !== undefined) {
    return /[⿰⿲⿺]/.test(结构符)
      ? `${firstfirst}${lastlast}`
      : `${lastlast}${firstfirst}`;
  }
  return `${lastlast}${firstfirst}`;
}

interface 张码部件分析 extends 默认部件分析 {
  补码: [string];
  为准码元: ["true" | "false"];
}

class 张码部件分析器 extends 部件分析器<张码部件分析> {
  static readonly type = "张码";
  constructor(private 配置: 字形分析配置) {
    super();
  }

  分析(部件: 部件) {
    const 基本分析或错误 = 部件.给出部件分析(this.配置);
    if (!基本分析或错误.ok) return 基本分析或错误;
    const 基本分析 = 基本分析或错误.value;
    const 补码 = 计算张码补码(基本分析.字根序列, this.配置.分类器);
    const 存在相交 = 基本分析.当前拆分方式.评价.get("能连不交")?.[0];
    const 为准码元 =
      基本分析.当前拆分方式.拆分方式.length === 2 && 存在相交 && 存在相交 > 0
        ? "true"
        : "false";
    return ok({
      ...基本分析,
      补码: [补码] as [string],
      为准码元: [为准码元] as ["true" | "false"],
    });
  }

  动态分析(_: 部件) {
    return default_err("动态分析未实现");
  }
}

function 定制化分析<T extends 基本部件分析 | 默认部件分析>(
  字符: 字符,
  部件分析: T,
  config: 字形分析配置,
) {
  const 名称 = 字符.toString();
  const 单笔字根列表 = [...new Set(Object.values(config.分类器))].map((x) =>
    单笔字根.创建(x),
  );
  const 自定义分析 = config.分析配置.customize ?? {};
  const 字根名称序列 = 自定义分析[名称];
  if (字根名称序列 === undefined) return 部件分析;
  const 字根序列 = 字根名称序列.map(
    (name) =>
      config.部件字根列表.find((x) => x.获取名称() === name) ??
      单笔字根列表.find((x) => x.获取名称() === name)!,
  );
  const 新分析: T = { ...部件分析, 字根序列 };
  if ("全部拆分方式" in 新分析) {
    新分析.被覆盖拆分方式 = 新分析.当前拆分方式;
    const 拆分方式 = 新分析.全部拆分方式.find((x) => {
      return isEqual(
        x.拆分方式.map((y) => y.字根.获取名称()),
        字根名称序列,
      );
    });
    if (拆分方式 !== undefined) {
      新分析.当前拆分方式 = 拆分方式;
    }
  }
  return 新分析;
}

function 动态定制化分析<T extends 基本部件分析 | 默认部件分析>(
  字符: 字符,
  部件分析列表: T[],
  config: 字形分析配置,
) {
  const 名称 = 字符.toString();
  const 动态自定义分析 = config.分析配置?.dynamic_customize ?? {};
  const 自定义分析 = config.分析配置.customize ?? {};
  let 全部字根序列 = 动态自定义分析[名称];
  if (全部字根序列 === undefined && 自定义分析[名称] !== undefined) {
    全部字根序列 = [自定义分析[名称]];
  }
  if (全部字根序列 === undefined) return 部件分析列表;
  const 新分析: T[] = [];
  for (const 字根序列 of 全部字根序列) {
    const 分析 = 部件分析列表.find((x) => isEqual(x.字根序列, 字根序列));
    if (分析) {
      新分析.push(分析);
    } else {
      // 如果找不到完全匹配的分析，就用定制化分析覆盖当前分析
      const 假装分析 = { ...部件分析列表[0]!, 字根序列 };
      新分析.push(假装分析);
    }
  }
  return 新分析;
}

interface 逸码拆分方式 {
  字根: 字根[];
  补码: 字根[];
}

interface 逸码部件分析 extends 基本部件分析 {
  余二拆分方式: 逸码拆分方式;
  余一拆分方式: 逸码拆分方式;
  笔画拆分方式: 逸码拆分方式;
}

class 逸码部件分析器 extends 部件分析器<逸码部件分析> {
  static readonly type = "逸码";
  constructor(private 配置: 字形分析配置) {
    super();
  }

  private 限制字根数量(拆分方式: 拆分方式, n: number, 图形: 部件) {
    const get = (i: number) =>
      二笔字根.创建(this.配置.分类器[图形._笔画列表()[i]!.feature]!, 0);
    const 新拆分方式 = {
      字根: 拆分方式.slice(0, n).map((x) => x.字根),
      补码: [] as 字根[],
    };
    if (拆分方式.length <= n) {
      for (const 笔画 of 拆分方式.at(-1)!.笔画索引) {
        新拆分方式.补码.push(get(笔画));
      }
      while (新拆分方式.补码.length < 6) {
        新拆分方式.补码.push(新拆分方式.补码.at(-1)!);
      }
    } else {
      const 全部笔画 = range(图形.笔画数());
      const 已用笔画 = new Set(拆分方式.slice(0, n).flatMap((x) => x.笔画索引));
      const 未用笔画 = 全部笔画.filter((x) => !已用笔画.has(x));
      未用笔画.map((x) => 新拆分方式.字根.push(get(x)));
      while (新拆分方式.补码.length < 6) {
        新拆分方式.补码.push(新拆分方式.字根.at(-1)!);
      }
    }
    return 新拆分方式;
  }

  private 自定义限制字根数量(字根序列: 字根[], n: number) {
    const 新拆分方式 = {
      字根: 字根序列.slice(0, n),
      补码: [] as 字根[],
    };
    if (字根序列.length <= n) {
      for (const 笔画 of 字根序列.at(-1)!.获取笔画序列(this.配置.分类器)) {
        新拆分方式.补码.push(二笔字根.创建(笔画, 0));
      }
      while (新拆分方式.补码.length < 6) {
        新拆分方式.补码.push(新拆分方式.补码.at(-1)!);
      }
    } else {
      const 未用笔画 = 字根序列
        .slice(n)
        .flatMap((x) => x.获取笔画序列(this.配置.分类器));
      未用笔画.map((x) => 新拆分方式.字根.push(二笔字根.创建(x, 0)));
      while (新拆分方式.补码.length < 6) {
        新拆分方式.补码.push(新拆分方式.字根.at(-1)!);
      }
    }
    return 新拆分方式;
  }

  分析(部件: 部件) {
    const 可选分析 = 部件.给出部件分析(this.配置);
    if (!可选分析.ok) return 可选分析;
    const 分析 = 定制化分析(部件.字符, 可选分析.value, this.配置);
    let 余二拆分方式: 逸码拆分方式,
      余一拆分方式: 逸码拆分方式,
      笔画拆分方式: 逸码拆分方式;
    const 拆分方式 = 分析.当前拆分方式.拆分方式;
    if (
      isEqual(
        拆分方式.map((x) => x.字根),
        分析.字根序列,
      )
    ) {
      余二拆分方式 = this.限制字根数量(拆分方式, 2, 部件);
      余一拆分方式 = this.限制字根数量(拆分方式, 1, 部件);
      笔画拆分方式 = this.限制字根数量(拆分方式, 0, 部件);
    } else {
      余二拆分方式 = this.自定义限制字根数量(分析.字根序列, 2);
      余一拆分方式 = this.自定义限制字根数量(分析.字根序列, 1);
      笔画拆分方式 = this.自定义限制字根数量(分析.字根序列, 0);
    }
    const result = {
      ...分析,
      字根序列: 余二拆分方式.字根.concat(余二拆分方式.补码),
      余二拆分方式,
      余一拆分方式,
      笔画拆分方式,
    };
    return ok(result);
  }
}

export {
  二笔部件分析器,
  张码部件分析器,
  逸码部件分析器,
  计算张码补码,
  部件,
  默认部件分析器,
  定制化分析,
};
export type {
  张码部件分析,
  逸码拆分方式,
  逸码部件分析,
  拆分方式与评价,
  部件分析器,
  默认部件分析,
};
