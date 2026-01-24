import { bisectLeft, bisectRight } from "d3-array";
import { isEqual, range } from "lodash-es";
import { 区间, 拓扑, 笔画图形 } from "./bezier.js";
import type { 分类器, 笔画名称 } from "./classifier.js";
import type { 退化配置 } from "./config.js";
import type { 基本部件数据, 矢量图形数据, 结构表示符 } from "./data.js";
import { isCollinear, isLess, sorted } from "./math.js";
import type { 基本分析, 字形分析配置 } from "./repertoire.js";
import {
  默认筛选器列表,
  type 拆分方式,
  type 拆分环境,
  type 筛选器,
} from "./selector.js";
import { default_err, ok, type Result } from "./utils.js";
import { getRegistry } from "./main.js";

export const defaultDegenerator: 退化配置 = {
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
class 部件图形 {
  名称: string;
  private 笔画列表: 笔画图形[];
  private 拓扑: 拓扑;

  constructor(name: string, glyph: 矢量图形数据) {
    this.名称 = name;
    this.笔画列表 = glyph.map((x) => new 笔画图形(x));
    this.拓扑 = new 拓扑(this.笔画列表);
  }

  _笔画列表() {
    return this.笔画列表;
  }

  _拓扑() {
    return this.拓扑;
  }

  笔画数() {
    return this.笔画列表.length;
  }

  计算笔画序列(classifier: 分类器) {
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
    const [smaller, larger] = sorted([i, j]);
    return this.拓扑.orientedPairs.some((x) => isEqual(x, [larger, smaller]));
  }

  /**
   * 给定一个部件和一个字根，找出这个部件所有包含这个字根的方式
   * 如果部件不包含这个字根，就返回空列表
   *
   * @param root - 字根
   * @param degenerator - 退化器
   */
  生成二进制切片列表(root: 部件图形, degenerator: 退化配置) {
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
          others.map((y) => sorted([x, y])),
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
    二进制字根映射: Map<number, string>,
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
            名称: 二进制字根映射.get(v)!,
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
  验证特殊字根(root: 部件图形, indices: number[]) {
    if (["土", "士"].includes(root.名称)) {
      const [i1, _, i3] = indices as [number, number, number];
      const upperHeng = this.笔画列表[i1]!.curveList[0]!;
      const lowerHeng = this.笔画列表[i3]!.curveList[0]!;
      const lowerIsLonger = upperHeng.length() < lowerHeng.length();
      return root.名称 === "土" ? lowerIsLonger : !lowerIsLonger;
    }
    if (["未", "末"].includes(root.名称)) {
      const [i1, i2] = indices as [number, number];
      const upperHeng = this.笔画列表[i1]!.curveList[0]!;
      const lowerHeng = this.笔画列表[i2]!.curveList[0]!;
      const lowerIsLonger = upperHeng.length() < lowerHeng.length();
      return root.名称 === "未" ? lowerIsLonger : !lowerIsLonger;
    }
    if (["口", "囗"].includes(root.名称)) {
      if (["囗", "\ue02d"].includes(this.名称)) {
        return root.名称 === "囗";
      }
      const [i1, _, i3] = indices as [number, number, number];
      const upperLeft = this.笔画列表[i1]!.curveList[0]!.evaluate(0);
      const lowerRight = this.笔画列表[i3]!.curveList[0]!.evaluate(1);
      const xrange = new 区间(upperLeft[0], lowerRight[0]);
      const yrange = new 区间(upperLeft[1], lowerRight[1]);
      const otherStrokes = this.笔画列表.filter(
        (_, index) => !indices.includes(index),
      );
      const containsStroke = otherStrokes.some((stroke) =>
        stroke.isBoundedBy(xrange, yrange),
      );
      return root.名称 === "囗" ? containsStroke : !containsStroke;
    }
    if (["\ue087" /* 木无十 */, "\ue43d" /* 全字头 */].includes(root.名称)) {
      const [i1] = indices as [number];
      const attachPoint = this.笔画列表[i1]!.curveList[0]!.evaluate(0);
      const otherStrokes = this.笔画列表.filter(
        (_, index) => !indices.includes(index),
      );
      const otherCurves = otherStrokes.flatMap((s) => s.curveList);
      const pieAndNaIsSeparated = otherCurves.some(
        (x) =>
          x.getType() === "linear" &&
          isCollinear(x.evaluate(0), x.evaluate(1), attachPoint),
      );
      return root.名称 === "\ue087"
        ? pieAndNaIsSeparated
        : !pieAndNaIsSeparated;
    }
    return true;
  }

  生成二进制字根映射(
    字根图形映射: Map<string, 部件图形>,
    退化配置: 退化配置,
    分类器: 分类器,
  ) {
    const 二进制字根映射 = new Map<number, string>(
      this.笔画列表.map((stroke, index) => {
        const 二进制数 = 1 << (this.笔画数() - 1 - index);
        return [二进制数, 分类器[stroke.feature].toString()];
      }),
    );
    for (const 字根图形 of 字根图形映射.values()) {
      const 二进制列表 = this.生成二进制切片列表(字根图形, 退化配置);
      二进制列表.map((二进制数) => 二进制字根映射.set(二进制数, 字根图形.名称));
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
    const 当前字根 = new Set([...配置.字根决策.keys()]);
    const 可选字根 = new Set([...配置.可选字根.keys()]);
    const 必要字根 = new Set([...当前字根].filter((x) => !可选字根.has(x)));
    const 退化配置 = 配置.分析配置?.degenerator ?? defaultDegenerator;
    const 二进制字根映射 = this.生成二进制字根映射(
      配置.字根图形映射,
      退化配置,
      配置.分类器,
    );
    const 字根笔画索引映射 = new Map<string, number[][]>();
    for (const [二进制数, 字根名] of 二进制字根映射) {
      const 索引 = this.二进制转索引(二进制数);
      if (索引.length === 1) continue;
      if (!字根笔画索引映射.has(字根名)) 字根笔画索引映射.set(字根名, [索引]);
      else 字根笔画索引映射.get(字根名)!.push(索引);
    }
    const 字根二进制列表 = Array.from(二进制字根映射.keys()).sort(
      (a, b) => a - b,
    );
    const 必要字根二进制集合: Set<number> = new Set();
    for (const [二进制数, 字根名] of 二进制字根映射) {
      if (必要字根.has(字根名)) 必要字根二进制集合.add(二进制数);
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
      x.拆分方式.every((y) => 当前字根.has(y.名称)),
    )!;
    if (当前拆分方式 === undefined) {
      return default_err("无法找到符合当前字根集合的拆分方式");
    }
    const 字根序列 = 当前拆分方式.拆分方式.map((x) => x.名称);
    return ok({
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
    二进制字根映射: Map<number, string>,
    必要字根: Set<string>,
  ): 拆分方式与评价[] {
    const environment: 拆分环境 = {
      部件图形: this,
      二进制字根映射,
      ...配置,
    };
    const 筛选器列表: [string, 筛选器][] = [];
    for (const name of 配置.分析配置.selector ?? 默认筛选器列表) {
      const 筛选器 = getRegistry().创建筛选器(name);
      if (筛选器) {
        筛选器列表.push([name, 筛选器]);
      }
    }
    const 拆分方式与评价列表 = 拆分方式列表.map((拆分方式) => {
      const 评价: Map<string, number[]> = new Map();
      for (const [name, 筛选器] of 筛选器列表) {
        const 取值 = 筛选器.evaluate(拆分方式, environment);
        评价.set(name, 取值);
      }
      return { 拆分方式, 评价, 可用: false };
    });
    拆分方式与评价列表.sort((a, b) => {
      for (const [name, _] of 筛选器列表) {
        const aValue = a.评价.get(name)!;
        const bValue = b.评价.get(name)!;
        if (isLess(aValue, bValue)) return -1;
        if (isLess(bValue, aValue)) return 1;
      }
      return 0;
    });
    const 包含可选字根列表 = 拆分方式与评价列表.map((x) =>
      x.拆分方式.map((y) => y.名称).filter((y) => !必要字根.has(y)),
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
      if (拆分方式与评价.拆分方式.every((x) => 必要字根.has(x.名称))) {
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

interface 部件分析器<部件分析 extends 基本分析 = 基本分析> {
  /**
   * 根据部件数据进行分析并返回分析结果
   *
   * @param 名称 - 部件名称
   * @param 部件 - 部件数据
   */
  分析(名称: string, 部件: 基本部件数据): Result<部件分析, Error>;
}

/**
 * 部件通过自动拆分算法分析得到的拆分结果的全部细节
 */
interface 默认部件分析 {
  字根序列: string[];
  部件图形: 部件图形;
  字根笔画映射: Map<string, number[][]>;
  当前拆分方式: 拆分方式与评价;
  全部拆分方式: 拆分方式与评价[];
}

class 默认部件分析器 implements 部件分析器<默认部件分析> {
  static readonly type = "默认";
  constructor(private 配置: 字形分析配置) {}

  分析(名称: string, 部件: 基本部件数据) {
    const 图形 =
      this.配置.字根图形映射.get(名称) ?? new 部件图形(名称, 部件.strokes);
    return 图形.给出部件分析(this.配置);
  }
}

class 二笔部件分析器 implements 部件分析器<基本分析> {
  static readonly type = "二笔";
  constructor(private 配置: 字形分析配置) {}

  分析(名称: string, 部件: 基本部件数据) {
    if (this.配置.字根决策.has(名称)) return ok({ 字根序列: [名称] });
    const 笔画分类器 = this.配置.分类器;
    const 笔画列表 = 部件.strokes;
    const 第一笔 = 笔画列表[0];
    if (!第一笔) {
      return default_err("部件没有笔画，无法进行二笔分析");
    }
    const 第二笔 = 笔画列表[1];
    const 第一笔类别 = 笔画分类器[第一笔.feature].toString();
    const 第二笔类别 = 第二笔 ? 笔画分类器[第二笔.feature].toString() : "0";
    const 结果 = { 字根序列: [第一笔类别 + 第二笔类别] };
    if (笔画列表.length > 2) {
      const 末笔 = 笔画列表.at(-1)!;
      const 末笔类别 = 笔画分类器[末笔.feature].toString();
      结果.字根序列.push(末笔类别);
    }
    return ok(结果);
  }
}

function 计算张码补码(
  字根序列: string[],
  字根笔画映射: Map<string, number[]>,
  结构符?: 结构表示符,
) {
  // 在补码时，竖钩视为竖，横折弯钩视为折
  const coalesce = [0, 1, 2, 3, 4, 5, 2, 5];
  const first = 字根笔画映射.get(字根序列[0]!)!;
  const last = 字根笔画映射.get(字根序列[字根序列.length - 1]!)!;
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

class 张码部件分析器 implements 部件分析器<张码部件分析> {
  static readonly type = "张码";
  constructor(private 配置: 字形分析配置) {}

  分析(名称: string, 部件: 基本部件数据) {
    const 图形 =
      this.配置.字根图形映射.get(名称) ?? new 部件图形(名称, 部件.strokes);
    const 基本分析或错误 = 图形.给出部件分析(this.配置);
    if (!基本分析或错误.ok) return 基本分析或错误;
    const 基本分析 = 基本分析或错误.value;
    const 补码 = 计算张码补码(基本分析.字根序列, this.配置.字根笔画映射);
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
}

interface 逸码部件分析 extends 基本分析 {
  余一字根序列: string[];
  笔画序列: string[];
}

class 逸码部件分析器 implements 部件分析器<逸码部件分析> {
  static readonly type = "逸码";
  constructor(private 配置: 字形分析配置) {}

  限制字根数量(拆分方式: 拆分方式, n: number, 图形: 部件图形) {
    const 新拆分方式 = 拆分方式.slice(0, n);
    let 补笔画: number[];
    if (拆分方式.length <= n) {
      补笔画 = 拆分方式.at(-1)!.笔画索引;
    } else {
      const 全部笔画 = range(图形.笔画数());
      const 已用笔画 = new Set(拆分方式.slice(0, n).flatMap((x) => x.笔画索引));
      const 未用笔画 = 全部笔画.filter((x) => !已用笔画.has(x));
      补笔画 = 未用笔画;
    }
    for (const 笔画 of 补笔画) {
      const 名称 = this.配置.分类器[图形._笔画列表()[笔画]!.feature].toString();
      const 笔画二进制表示 = 1 << (图形.笔画数() - 1 - 笔画);
      新拆分方式.push({
        名称: `${名称}0`,
        笔画索引: [笔画],
        笔画二进制表示,
      });
    }
    return 新拆分方式;
  }

  分析(名称: string, 部件: 基本部件数据) {
    const 图形 =
      this.配置.字根图形映射.get(名称) ?? new 部件图形(名称, 部件.strokes);
    const 可选分析 = 图形.给出部件分析(this.配置);
    if (!可选分析.ok) return 可选分析;
    const 分析 = 可选分析.value;
    const 拆分方式 = 分析.当前拆分方式.拆分方式;
    const 余二拆分方式 = this.限制字根数量(拆分方式, 2, 图形);
    const 余一拆分方式 = this.限制字根数量(拆分方式, 1, 图形);
    const 笔画拆分方式 = this.限制字根数量(拆分方式, 0, 图形);
    const result = {
      ...分析,
      字根序列: 余二拆分方式.map((x) => x.名称),
      余一字根序列: 余一拆分方式.map((x) => x.名称),
      笔画序列: 笔画拆分方式.map((x) => x.名称),
    };
    return ok(result);
  }
}

export {
  二笔部件分析器,
  张码部件分析器,
  逸码部件分析器,
  计算张码补码,
  部件图形,
  默认部件分析器,
};
export type {
  张码部件分析,
  逸码部件分析,
  拆分方式与评价,
  部件分析器,
  默认部件分析,
};

// if (serializerName === "xkjd") {
//   for (const [_, result] of componentResults.entries()) {
//     result.sequence = limit(result.sequence, 4, config);
//   }
// } else if (serializerName === "snow2") {
//   for (const [key, result] of componentResults.entries()) {
//     result.sequence = result.sequence.slice(0, 1);
//     if (result.sequence[0] !== key) result.sequence.push("");
//   }
// } else if (serializerName === "feihua") {
//   for (const [key, result] of componentResults.entries()) {
//     if ("schemes" in result) {
//       const dc = config.analysis?.dynamic_customize ?? {};
//       const schemeList =
//         dc[key] ??
//         result.schemes.filter((x) => x.optional).map((x) => x.roots);
//       const scheme = schemeList.find((x) =>
//         x.every((r) => {
//           let value = config.roots.get(r)!;
//           while (isMerge(value)) {
//             value = config.roots.get(value.element)!;
//           }
//           return /[aoeiuv;/]/.test(value as string);
//         }),
//       )!;
//       result.full2 = scheme;
//       result.sequence = scheme.slice(0, 3);
//     } else {
//       result.full2 = [...result.full];
//     }
//   }
// }

// if (serializerName === "feihua") {
//   const rawOperandResults = glyph.operandList.map(getResult);
//   const operandResults = rawOperandResults as PartitionResult[];
//   const serialization = serializer(operandResults, glyph, config);
//   serialization.full = [char];
//   let value = config.roots.get(char)!;
//   while (isMerge(value)) {
//     value = config.roots.get(value.element)!;
//   }
//   if (/[aoeiuv;/]/.test(value as string)) {
//     serialization.full2 = [char];
//   }
//   compoundResults.set(char, serialization);
//   continue;
// }
// // 复合体本身是一个字根
// const sequence = [char];
// if (serializerName === "snow2") {
//   sequence.push("q");
// }
