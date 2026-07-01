import { range, sortBy } from "lodash-es";
import type { 分类器, 笔画名称 } from "./classifier.js";
import {
  冰雪飞花分析器,
  type 冰雪飞花部件分析,
  type 张码部件分析,
  计算张码补码,
  type 逸码部件分析,
  部件,
  type 首末取大部件分析,
  type 默认部件分析,
} from "./component.js";
import type { 旧笔画块, 结构描述字符 } from "./data.js";
import { 二笔, 未知元素, 结构符元素 } from "./element.js";
import {
  优先表,
  type 基本复合体分析,
  type 基本部件分析,
  type 字形,
  type 字形分析配置,
  type 字根,
  存在,
  type 带条件,
  是复合体,
  是部件,
  贝叶斯推断,
} from "./repertoire.js";
import type { 字符 } from "./unicode.js";
import { default_err, ok, type Result, type 源标签集合 } from "./utils.js";

class 复合体 {
  private 笔画列表: 笔画名称[];

  constructor(
    public 字符: 字符,
    public 标签集合: 源标签集合,
    public 兼容: boolean,
    public 结构描述字符: 结构描述字符,
    public 部分列表: 字形[],
    public 笔顺: 旧笔画块[],
  ) {
    this.笔画列表 = this.计算笔画列表(笔顺, 部分列表);
  }

  /**
   * 将复合体递归渲染为 SVG 图形
   *
   * @param compound - 复合体
   * @param repertoire - 原始字符集
   *
   * @returns SVG 图形或错误
   */
  计算笔画列表(笔顺: 旧笔画块[], 部分列表: 字形[]): 笔画名称[] {
    const 各部分笔画列表: 笔画名称[][] = [];
    for (const 字形 of 部分列表) {
      if (字形 instanceof 部件) {
        各部分笔画列表.push(字形.矢量图形.map((x) => x.feature));
      } else {
        各部分笔画列表.push(字形.笔画列表);
      }
    }
    const merged: 笔画名称[] = [];
    for (const { index, strokes } of 笔顺) {
      const seq = 各部分笔画列表[index];
      if (seq === undefined) continue;
      if (strokes === 0) {
        merged.push(...seq);
      } else {
        merged.push(...seq.slice(0, strokes));
        各部分笔画列表[index] = seq.slice(strokes);
      }
    }
    return merged;
  }

  按首笔排序部分(): 字形[] {
    const 部分列表 = sortBy(range(this.部分列表.length), (i) =>
      this.笔顺.findIndex((b) => b.index === i),
    ).map((i) => this.部分列表[i]!);
    return 部分列表;
  }

  获取笔画序列(classifier: 分类器) {
    return this.笔画列表.map((f) => classifier[f]);
  }
}

type 字根序列与条件 = 带条件<{ 字根序列: 字根[] }>;

abstract class 复合体分析器<
  部件分析 extends 基本部件分析 = 基本部件分析,
  复合体分析 extends 基本复合体分析 = 基本复合体分析,
> {
  public 部件分析结果: Map<部件, 部件分析> = new Map();
  public 动态部件分析结果: Map<部件, 优先表<部件分析>> = new Map();

  constructor(protected 配置: 字形分析配置) {}

  查找部件分析结果(部件: 部件): 部件分析 | undefined {
    return this.部件分析结果.get(部件);
  }

  查找动态部件分析结果(部件: 部件): 优先表<部件分析> | undefined {
    return this.动态部件分析结果.get(部件);
  }

  顺序取根(字形: 字形): 字根[] {
    if (是部件(字形)) return this.查找部件分析结果(字形)!.字根序列;
    const 字根 = this.配置.复合体字根映射.get(字形);
    if (字根 !== undefined && this.配置.字根决策.has(字根)) return [字根];
    const 部分结果列表 = 字形.部分列表.map((子字形) => {
      let 字根序列: 字根[];
      let 部件分析: 部件分析 | undefined;
      if (是部件(子字形)) {
        部件分析 = this.查找部件分析结果(子字形);
        字根序列 = 部件分析!.字根序列;
      } else 字根序列 = this.顺序取根(子字形);
      return { 字根序列, 部件分析 };
    });
    const result = this.执行笔顺(部分结果列表, 字形.笔顺);
    return result;
  }

  动态顺序取根(字形: 字形): 字根序列与条件[] {
    if (是部件(字形)) {
      return [...this.查找动态部件分析结果(字形)!];
    }
    const 结果列表: 带条件<{ 字根序列: 字根[] }>[] = [];
    const 字根 = this.配置.复合体字根映射.get(字形);
    if (字根 !== undefined) {
      const 条件列表 = this.配置.可选字根.has(字根) ? [存在(字根)] : [];
      结果列表.push({
        字根序列: [字根],
        条件列表,
      });
      if (!this.配置.可选字根.has(字根)) return 结果列表;
    }
    const 部分结果组列表 = 字形.部分列表.map((子字形) => {
      const 部分结果组 = [];
      if (是部件(子字形)) {
        for (const 分析 of this.查找动态部件分析结果(子字形)!) {
          部分结果组.push({
            字根序列: 分析.字根序列,
            部件分析: 分析,
            条件列表: 分析.条件列表,
          });
        }
      } else {
        const 动态结果 = this.动态顺序取根(子字形);
        for (const { 字根序列, 条件列表 } of 动态结果) {
          部分结果组.push({ 字根序列, 部件分析: undefined, 条件列表 });
        }
      }
      return 部分结果组;
    });
    return 结果列表.concat(
      贝叶斯推断(部分结果组列表, (组合) => {
        const 字根序列 = this.执行笔顺(组合, 字形.笔顺);
        return { 字根序列 };
      }),
    );
  }

  执行笔顺(
    部分结果列表: {
      字根序列: 字根[];
      部件分析?: 部件分析;
    }[],
    笔顺: 旧笔画块[],
  ): 字根[] {
    const 已取笔画数列表 = 部分结果列表.map(() => 0);
    const 字根序列: 字根[] = [];
    const 剩余字根序列列表 = 部分结果列表.map((x) => [...x.字根序列]);
    for (const { index, strokes } of 笔顺) {
      const 剩余部分 = 部分结果列表[index];
      const 剩余部分字根序列 = 剩余字根序列列表[index];
      if (剩余部分 === undefined || 剩余部分字根序列 === undefined) continue; // 忽略无效部分
      const 部件分析 = 剩余部分.部件分析;
      if (
        strokes === 0 ||
        部件分析 === undefined ||
        !("当前拆分方式" in 部件分析)
      ) {
        字根序列.push(...剩余部分字根序列);
        剩余字根序列列表[index] = [];
      } else {
        const { 当前拆分方式 } = 部件分析 as any as 默认部件分析;
        const toTake = 当前拆分方式.拆分方式.filter(
          (x) =>
            x.笔画索引[0]! >= 已取笔画数列表[index]! &&
            x.笔画索引[0]! <= 已取笔画数列表[index]! + strokes - 1,
        ).length;
        字根序列.push(...剩余部分字根序列.slice(0, toTake));
        剩余字根序列列表[index] = 剩余部分字根序列.slice(toTake);
        已取笔画数列表[index]! += strokes;
      }
    }
    return 字根序列;
  }

  /**
   * 对复合体分析并返回分析结果
   */
  分析(_: 复合体): Result<复合体分析, Error> {
    return default_err("分析未实现");
  }

  /**
   * 对复合体进行动态分析并返回分析结果组
   */
  动态分析(_: 复合体): Result<优先表<复合体分析>, Error> {
    return default_err("动态分析未实现");
  }
}

export interface 默认复合体分析 extends 基本复合体分析 {
  结构: 结构符元素;
}

class 默认复合体分析器 extends 复合体分析器<默认部件分析, 默认复合体分析> {
  static readonly type = "默认";
  private 全部结构符元素: Set<结构符元素>;

  constructor(x: 字形分析配置) {
    super(x);
    this.全部结构符元素 = new Set(
      [...x.决策.keys(), ...x.决策空间.keys()].filter(
        (y) => y instanceof 结构符元素,
      ),
    );
  }

  分析(复合体: 复合体) {
    const 分析: 默认复合体分析 = {
      类型: "复合体",
      复合体,
      结构: this.全部结构符元素
        .values()
        .find((x) => x.获取名称() === 复合体.结构描述字符)!,
      字根序列: [],
    };
    分析.字根序列.push(...this.顺序取根(复合体));
    return ok(分析);
  }

  动态分析(复合体: 复合体) {
    const 结果列表: 带条件<默认复合体分析>[] = [];
    for (const { 字根序列, 条件列表 } of this.动态顺序取根(复合体)) {
      结果列表.push({
        类型: "复合体",
        复合体,
        字根序列,
        结构: this.全部结构符元素
          .values()
          .find((x) => x.获取名称() === 复合体.结构描述字符)!,
        条件列表,
      });
    }
    return ok(new 优先表(结果列表));
  }
}

class 首末取大复合体分析器 extends 复合体分析器<
  首末取大部件分析,
  默认复合体分析
> {
  static readonly type = "首末取大";
  private 全部结构符元素: Set<结构符元素>;

  constructor(x: 字形分析配置) {
    super(x);
    this.全部结构符元素 = new Set(
      [...x.决策.keys(), ...x.决策空间.keys()].filter(
        (y) => y instanceof 结构符元素,
      ),
    );
  }

  分析(复合体: 复合体) {
    const 分析: 默认复合体分析 = {
      类型: "复合体",
      复合体,
      结构: this.全部结构符元素
        .values()
        .find((x) => x.获取名称() === 复合体.结构描述字符)!,
      字根序列: [],
    };
    const 首末取大结果 = this.首末取大顺序取根(复合体);
    分析.字根序列.push(首末取大结果[0]!, 首末取大结果.at(-1)!);
    return ok(分析);
  }

  // 重写这个方法，考虑到首部件取大优先，末部件倒序取大
  首末取大顺序取根(字形: 字形, 末尾 = true): 字根[] {
    if (是部件(字形)) {
      const 部件分析 = this.查找部件分析结果(字形)!;
      return 末尾 ? 部件分析.逆序取大字根序列 : 部件分析.正序取大字根序列;
    }
    const 字根 = this.配置.复合体字根映射.get(字形);
    if (字根 !== undefined && this.配置.字根决策.has(字根)) return [字根];
    const 排序部分列表 = 字形.按首笔排序部分();
    const 部分结果列表 = 字形.部分列表.map((子字形) => {
      let 部件分析: 首末取大部件分析 | undefined;
      const 当前是末尾 = 排序部分列表.indexOf(子字形) === 排序部分列表.length - 1;
      if (是部件(子字形)) 部件分析 = this.查找部件分析结果(子字形);
      const 下一级末尾 = 当前是末尾 && 末尾;
      const 字根序列 = this.首末取大顺序取根(子字形, 下一级末尾);
      return { 字根序列, 部件分析 };
    });
    const result = this.执行笔顺(部分结果列表, 字形.笔顺);
    return result;
  }
}

class 真码复合体分析器 extends 复合体分析器<默认部件分析> {
  static readonly type = "真码";

  分析(复合体: 复合体) {
    const 分析: 基本复合体分析 = {
      类型: "复合体",
      复合体,
      字根序列: [],
    };
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
    } else {
      if (复合体.结构描述字符 === "⿶") {
        // 下包围结构优先取内部
        for (const 字形 of [...复合体.部分列表].reverse()) {
          分析.字根序列.push(...this.顺序取根(字形));
        }
      } else {
        for (const 字形 of 复合体.部分列表) {
          分析.字根序列.push(...this.顺序取根(字形));
        }
      }
    }
    return ok(分析);
  }
}

class 首右复合体分析器 extends 复合体分析器<默认部件分析> {
  static readonly type = "首右";

  分析(复合体: 复合体) {
    const 分析: 基本复合体分析 = {
      类型: "复合体",
      复合体,
      字根序列: [],
    };
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined && this.配置.字根决策.has(字根)) {
      分析.字根序列.push(字根);
    } else {
      const [第一部, 第二部] = 复合体.按首笔排序部分();
      if (!第一部 || !第二部) return default_err(`${复合体.字符} 缺少部分`);
      const 完整字根序列 = this.顺序取根(复合体);
      const 第一部字根序列 = this.顺序取根(第一部);
      const 第二部字根序列 = this.顺序取根(第二部);
      if (/[⿰⿲]/.test(复合体.结构描述字符)) {
        分析.字根序列 = [第一部字根序列[0]!, 第二部字根序列[0]!];
      } else {
        分析.字根序列 = [完整字根序列[0]!, 完整字根序列.at(-1)!];
      }
    }
    return ok(分析);
  }

  动态分析(复合体: 复合体) {
    const 分析列表: 带条件<基本复合体分析>[] = [];
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      const 是可选字根 = this.配置.可选字根.has(字根);
      const 条件列表 = 是可选字根 ? [存在(字根)] : [];
      分析列表.push({ 类型: "复合体", 复合体, 字根序列: [字根], 条件列表 });
      if (!是可选字根) return ok(new 优先表(分析列表));
    }
    const [第一部, 第二部] = 复合体.按首笔排序部分();
    if (!第一部 || !第二部) return default_err(`${复合体.字符} 缺少部分`);
    if (/[⿰⿲]/.test(复合体.结构描述字符)) {
      const 第一部结果 = this.动态顺序取根(第一部).map(
        ({ 字根序列, 条件列表 }) => ({ 字根: 字根序列[0]!, 条件列表 }),
      );
      const 第二部结果 = this.动态顺序取根(第二部).map(
        ({ 字根序列, 条件列表 }) => ({ 字根: 字根序列[0]!, 条件列表 }),
      );
      分析列表.push(
        ...贝叶斯推断([第一部结果, 第二部结果] as const, ([x, y]) => ({
          类型: "复合体" as const,
          复合体,
          字根序列: [x.字根, y.字根],
        })),
      );
    } else {
      for (const { 字根序列, 条件列表 } of this.动态顺序取根(复合体)) {
        分析列表.push({
          类型: "复合体",
          复合体,
          字根序列: [字根序列[0]!, 字根序列.at(-1)!],
          条件列表,
        });
      }
    }
    return ok(new 优先表(分析列表));
  }
}

class 二笔复合体分析器 extends 复合体分析器 {
  static readonly type = "二笔";

  取首根(字形: 字形): 字根 {
    if (是部件(字形)) {
      return this.查找部件分析结果(字形)!.字根序列[0]!;
    } else {
      const 字根 = this.配置.复合体字根映射.get(字形);
      if (字根 !== undefined && this.配置.字根决策.has(字根)) return 字根;
      const 第一部 = 字形.按首笔排序部分()[0]!;
      return this.取首根(第一部);
    }
  }

  动态取首根(字形: 字形): 带条件<{ 字根: 字根 }>[] {
    const 结果列表: 带条件<{ 字根: 字根 }>[] = [];
    let 当前字形 = 字形;
    while (!是部件(当前字形)) {
      const 字根 = this.配置.复合体字根映射.get(当前字形);
      if (字根) {
        const 条件列表 = this.配置.可选字根.has(字根) ? [存在(字根)] : [];
        结果列表.push({ 字根, 条件列表 });
        if (!this.配置.可选字根.has(字根)) {
          return 结果列表;
        }
      }
      当前字形 = 当前字形.按首笔排序部分()[0]!;
    }
    const 部件分析 = this.查找动态部件分析结果(当前字形);
    if (!部件分析) return 结果列表;
    结果列表.push(
      ...[...部件分析].map((x) => ({
        条件列表: x.条件列表,
        字根: x.字根序列[0]!,
      })),
    );
    return 结果列表;
  }

  分析(复合体: 复合体) {
    const 分析: 基本复合体分析 = {
      类型: "复合体",
      复合体,
      字根序列: [],
    };
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined && this.配置.字根决策.has(字根)) {
      分析.字根序列.push(字根);
      return ok(分析);
    }
    const 排序部分结果 = 复合体.按首笔排序部分();
    if (排序部分结果.length === 3) {
      for (const 部分 of 排序部分结果) {
        分析.字根序列.push(this.取首根(部分));
      }
    } else {
      const [第一部, 第二部] = 排序部分结果;
      if (!第一部 || !第二部) return default_err(`${复合体.字符} 缺少部分`);
      分析.字根序列.push(this.取首根(第一部));
      if (第二部 instanceof 部件) {
        分析.字根序列.push(...this.查找部件分析结果(第二部)!.字根序列);
      } else {
        const 第二部字根 = this.配置.复合体字根映射.get(第二部);
        if (第二部字根 !== undefined && this.配置.字根决策.has(第二部字根)) {
          分析.字根序列.push(第二部字根);
        } else {
          const [第二部之一, 第二部之二] = 第二部.按首笔排序部分();
          if (!第二部之一 || !第二部之二)
            return default_err(`${复合体.字符} 缺少部分`);
          分析.字根序列.push(this.取首根(第二部之一));
          分析.字根序列.push(this.取首根(第二部之二));
        }
      }
    }
    return ok(分析);
  }

  动态分析(复合体: 复合体) {
    const 分析列表: 带条件<基本复合体分析>[] = [];
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      const 是可选字根 = this.配置.可选字根.has(字根);
      const 条件列表 = 是可选字根 ? [存在(字根)] : [];
      分析列表.push({ 类型: "复合体", 复合体, 字根序列: [字根], 条件列表 });
      if (!是可选字根) return ok(new 优先表(分析列表));
    }
    const 排序部分结果 = 复合体.按首笔排序部分();
    if (排序部分结果.length === 3) {
      const 部分结果列表 = 排序部分结果.map((x) => this.动态取首根(x));
      分析列表.push(
        ...贝叶斯推断(部分结果列表, (xs) => ({
          类型: "复合体" as const,
          复合体,
          字根序列: xs.map((x) => x.字根),
        })),
      );
    } else {
      const [第一部, 第二部] = 排序部分结果;
      if (!第一部 || !第二部) return default_err(`${复合体.字符} 缺少部分`);
      const 第一部结果 = this.动态取首根(第一部);
      if (第二部 instanceof 部件) {
        const 第二部结果 = this.查找动态部件分析结果(第二部);
        if (第二部结果 === undefined)
          return default_err(`${第二部.字符.获取名称()} 查询不到`);
        分析列表.push(
          ...贝叶斯推断([第一部结果, [...第二部结果]] as const, ([x, y]) => ({
            类型: "复合体" as const,
            复合体,
            字根序列: [x.字根, ...y.字根序列],
          })),
        );
      } else {
        const 第二部合并后结果: 带条件<{ 字根序列: 字根[] }>[] = [];
        const 第二部字根 = this.配置.复合体字根映射.get(第二部);
        let 继续分析 = true;
        if (第二部字根 !== undefined) {
          const 是可选字根 = this.配置.可选字根.has(第二部字根);
          const 条件列表 = 是可选字根 ? [存在(第二部字根)] : [];
          第二部合并后结果.push({ 字根序列: [第二部字根], 条件列表 });
          if (!是可选字根) 继续分析 = false;
        }
        if (继续分析) {
          const [第二部之一, 第二部之二] = 第二部.按首笔排序部分();
          if (!第二部之一 || !第二部之二)
            return default_err(`${复合体.字符} 缺少部分`);
          const 第二部之一结果 = this.动态取首根(第二部之一);
          const 第二部之二结果 = this.动态取首根(第二部之二);
          第二部合并后结果.push(
            ...贝叶斯推断(
              [第二部之一结果, 第二部之二结果] as const,
              ([x, y]) => ({
                字根序列: [x.字根, y.字根],
              }),
            ),
          );
        }
        分析列表.push(
          ...贝叶斯推断([第一部结果, 第二部合并后结果] as const, ([x, y]) => ({
            类型: "复合体" as const,
            复合体,
            字根序列: [x.字根, ...y.字根序列],
          })),
        );
      }
    }
    return ok(new 优先表(分析列表));
  }
}

interface 星空键道复合体分析 extends 基本复合体分析 {
  首部字根序列: 字根[];
  余部字根序列: 字根[];
}

class 星空键道复合体分析器 extends 复合体分析器<
  默认部件分析,
  星空键道复合体分析
> {
  static readonly type = "星空键道";

  分析(复合体: 复合体) {
    const 分析: 星空键道复合体分析 = {
      类型: "复合体",
      复合体,
      字根序列: [],
      首部字根序列: [],
      余部字根序列: [],
    };
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
      return ok(分析);
    }
    分析.字根序列 = this.顺序取根(复合体);
    if (复合体.笔顺[0]?.index === 1) {
      // 第一个书写的部分只写了一笔，视同独体字取码
    } else {
      const 排序部分结果 = 复合体.按首笔排序部分();
      for (const [index, part] of 排序部分结果.entries()) {
        if (index === 0) {
          分析.首部字根序列.push(...this.顺序取根(part));
        } else {
          分析.余部字根序列.push(...this.顺序取根(part));
        }
      }
    }
    return ok(分析);
  }
}

interface 张码复合体分析 extends 基本复合体分析 {
  结构符: 结构描述字符;
  补码: 二笔;
  准码元: 未知元素;
}

class 张码复合体分析器 extends 复合体分析器<张码部件分析, 张码复合体分析> {
  static readonly type = "张码";

  顺序取根(字形: 字形): 字根[] {
    if (是部件(字形)) return this.查找部件分析结果(字形)!.字根序列;
    const 字根 = this.配置.复合体字根映射.get(字形);
    if (字根 !== undefined && this.配置.字根决策.has(字根)) return [字根];
    const 部分结果列表 = 字形.部分列表.map((子字形) => {
      let 字根序列: 字根[];
      if (是部件(子字形)) {
        const 部件分析 = this.查找部件分析结果(子字形);
        字根序列 = 部件分析!.字根序列;
      } else 字根序列 = this.顺序取根(子字形);
      return 字根序列;
    });
    if (字形.结构描述字符 === "⿶") {
      // 下包围结构优先取内部
      return 部分结果列表.reverse().flat();
    } else {
      return 部分结果列表.flat();
    }
  }

  分析(复合体: 复合体) {
    const 分析: 张码复合体分析 = {
      类型: "复合体",
      复合体,
      字根序列: [],
      结构符: 复合体.结构描述字符,
      补码: 二笔.创建(1, 1),
      准码元: new 未知元素("false"),
    };
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
    } else {
      const 展开部分列表 = this.展开嵌套上下和左右结构(复合体);
      if (/[⿱⿳]/.test(复合体.结构描述字符)) {
        分析.字根序列 = this.上下结构取码规则(展开部分列表);
      } else if (/[⿰⿲]/.test(复合体.结构描述字符)) {
        分析.字根序列 = this.左右结构取码规则(展开部分列表);
      } else {
        // 下包围和「竖折」笔画的左下包围优先取内部，其余取外部
        if (
          复合体.结构描述字符 === "⿶" ||
          (复合体.结构描述字符 === "⿺" &&
            复合体.部分列表[0]?.字符?.toNumber() === 0x31d7)
        ) {
          for (const part of [...复合体.部分列表].reverse())
            分析.字根序列.push(...this.顺序取根(part));
        } else {
          for (const part of 复合体.部分列表)
            分析.字根序列.push(...this.顺序取根(part));
        }
      }
    }
    分析.补码 = 计算张码补码(
      分析.字根序列,
      this.配置.分类器,
      复合体.结构描述字符,
    );
    return ok(分析);
  }

  展开嵌套上下和左右结构(复合体: 复合体) {
    if (复合体.部分列表.length !== 2 || !/[⿰⿱]/.test(复合体.结构描述字符))
      return 复合体.部分列表;
    const 展开后: 字形[] = [];
    const regex = 复合体.结构描述字符 === "⿰" ? /[⿰⿲]/ : /[⿱⿳]/;
    for (const 字形 of 复合体.部分列表) {
      if (
        展开后.length < 2 &&
        !是部件(字形) &&
        !this.配置.复合体字根映射.has(字形) &&
        regex.test(字形.结构描述字符)
      ) {
        展开后.push(...字形.部分列表);
      } else {
        展开后.push(字形);
      }
    }
    return 展开后;
  }

  寻找叠眼及其索引(部分列表: 字形[]) {
    // 叠眼不能是部件，不能是字根，必须是左右结构
    const index = 部分列表.findIndex(
      (x) =>
        !是部件(x) &&
        !this.配置.复合体字根映射.has(x) &&
        /[⿰⿲]/.test(x.结构描述字符),
    );
    return [部分列表.at(index) as 复合体 | undefined, index] as const;
  }

  上下结构取码规则(部分列表: 字形[]) {
    const 字根序列: 字根[] = [];
    const [叠眼, 叠眼索引] = this.寻找叠眼及其索引(部分列表);
    const 叠眼以上序列: 字根[] = [];
    let 叠眼展开: 字形[];
    switch (叠眼索引) {
      case -1: // 没有叠眼
        for (const 字形 of 部分列表) 字根序列.push(...this.顺序取根(字形));
        break;
      case 0: // 叠眼在开头
        叠眼展开 = this.展开嵌套上下和左右结构(叠眼!);
        // 先取叠眼各部分的首根
        for (const [index, 部分分析] of 叠眼展开.entries()) {
          if (index >= 2 && index < 叠眼展开.length - 1) continue; // 叠眼只取一二末
          字根序列.push(this.顺序取根(部分分析)[0]!);
        }
        // 然后取剩余部分的首根和末根
        if (部分列表.length > 2) {
          字根序列.push(this.顺序取根(部分列表[1]!)[0]!);
          字根序列.push(this.顺序取根(部分列表.at(-1)!).at(-1)!);
        } else {
          字根序列.push(...this.首末(this.顺序取根(部分列表[1]!)));
        }
        break;
      default: // 叠眼在中间或末尾
        叠眼展开 = this.展开嵌套上下和左右结构(叠眼!);
        // 叠眼以上，最多可顺序取两根
        for (let index = 0; index < 叠眼索引; ++index) {
          叠眼以上序列.push(...this.顺序取根(部分列表[index]!));
        }
        字根序列.push(...叠眼以上序列.slice(0, 2));
        if (叠眼索引 + 1 < 部分列表.length) {
          // 叠眼在中间时：
          // 如果已取两根，则取叠眼首根和叠眼以下的末根
          // 如果只取了一根，则取叠眼第一部分的首根、叠眼最后一部分的首根、叠眼以下的末根
          字根序列.push(this.顺序取根(叠眼展开[0]!).at(0)!);
          if (字根序列.length === 2) {
            字根序列.push(this.顺序取根(叠眼展开.at(-1)!).at(0)!);
          }
          字根序列.push(this.顺序取根(部分列表.at(-1)!).at(-1)!);
        } else {
          // 叠眼在末尾时：按正常顺序取根
          字根序列.push(...this.顺序取根(叠眼!));
        }
    }
    return 字根序列;
  }

  左右结构取码规则(部分列表: 字形[]) {
    const 字根序列: 字根[] = [];
    const 左部 = 部分列表[0]!;
    let 左部是眼叠 = false;
    if (是复合体(左部) && /[⿱⿳]/.test(左部.结构描述字符)) {
      // 左部是叠型
      const 左部展开 = this.展开嵌套上下和左右结构(左部);
      const [叠眼, 叠眼索引] = this.寻找叠眼及其索引(左部展开);
      let 叠眼展开: 字形[];
      switch (叠眼索引) {
        case -1: // 没有叠眼
          break;
        case 0: // 叠眼在开头
          左部是眼叠 = true;
          // 取左部叠眼首部分和末部分的首根
          叠眼展开 = this.展开嵌套上下和左右结构(叠眼!);
          字根序列.push(this.顺序取根(叠眼展开[0]!)[0]!);
          字根序列.push(this.顺序取根(叠眼展开.at(-1)!)[0]!);
          // 取左部剩余部分的末根
          字根序列.push(this.顺序取根(左部展开.at(-1)!).at(-1)!);
          break;
        default: // 叠眼在中间或末尾
          叠眼展开 = this.展开嵌套上下和左右结构(叠眼!);
          左部是眼叠 = true;
          // 取叠眼以上部分的首根
          字根序列.push(this.顺序取根(左部展开[0]!)[0]!);
          // 取叠眼首部分的首根
          字根序列.push(this.顺序取根(叠眼展开[0]!)[0]!);
          // 叠眼在末尾时，取叠眼末部分的末根
          if (叠眼索引 === 左部展开.length - 1)
            字根序列.push(this.顺序取根(叠眼展开.at(-1)!).at(-1)!);
          // 叠眼在中间时，取左部末部分的末根
          else 字根序列.push(this.顺序取根(左部展开.at(-1)!).at(-1)!);
      }
    }
    if (左部是眼叠) {
      // 已经处理完左部，直接取右部末码即可
      字根序列.push(this.顺序取根(部分列表.at(-1)!).at(-1)!);
    } else {
      // 一般情况，左部、中部最多各取首尾两根
      let 余部开始索引 = 1;
      字根序列.push(...this.首末(this.顺序取根(左部)));
      if (部分列表.length > 2) {
        字根序列.push(...this.首末(this.顺序取根(部分列表[1]!)));
        余部开始索引 = 2;
      }
      // 如果左部和中部已经有 4 根，舍弃一根
      if (字根序列.length === 4) 字根序列.pop();
      for (const 部分分析 of 部分列表.slice(余部开始索引)) {
        字根序列.push(...this.顺序取根(部分分析));
      }
    }
    return 字根序列;
  }

  首末(x: 字根[]) {
    return x.length === 1 ? x : [x[0]!, x.at(-1)!];
  }
}

class 逸码复合体分析器 extends 复合体分析器<逸码部件分析> {
  static readonly type = "逸码";

  列举全部部件(复合体: 复合体) {
    const 部件结果列表: 逸码部件分析[] = [];
    for (const 部分 of 复合体.部分列表) {
      if (部分 instanceof 部件) {
        部件结果列表.push(this.查找部件分析结果(部分)!);
      } else {
        const 部分结果 = this.列举全部部件(部分);
        部件结果列表.push(...部分结果);
      }
    }
    return 部件结果列表;
  }

  分析(复合体: 复合体) {
    const 分析: 基本复合体分析 = {
      类型: "复合体",
      复合体,
      字根序列: [],
    };
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
      const 笔画序列 = 字根.获取笔画序列(this.配置.分类器);
      for (const 笔画 of 笔画序列) {
        分析.字根序列.push(二笔.创建(笔画, 0));
      }
      while (分析.字根序列.length < 6) {
        分析.字根序列.push(分析.字根序列.at(-1)!);
      }
      return ok(分析);
    }
    const 部件序列 = this.列举全部部件(复合体);
    const 最后索引 = 部件序列.length - 1;
    for (const [索引, 部分] of 部件序列.entries()) {
      if (分析.字根序列.length === 0) {
        分析.字根序列.push(...部分.余二拆分方式.字根);
        if (索引 === 最后索引) 分析.字根序列.push(...部分.余二拆分方式.补码);
      } else if (分析.字根序列.length === 1) {
        分析.字根序列.push(...部分.余一拆分方式.字根);
        if (索引 === 最后索引) 分析.字根序列.push(...部分.余一拆分方式.补码);
      } else {
        分析.字根序列.push(...部分.笔画拆分方式.字根);
        if (索引 === 最后索引) 分析.字根序列.push(...部分.笔画拆分方式.补码);
      }
    }
    return ok(分析);
  }
}

interface 冰雪飞花复合体分析 extends 基本复合体分析 {
  部首?: 字根;
  余部: 字根[];
}

interface 冰雪飞花部分信息 {
  部分: 字形;
  是单字根: boolean;
  首根: 字根;
}

class 冰雪飞花复合体分析器 extends 复合体分析器<
  冰雪飞花部件分析,
  冰雪飞花复合体分析
> {
  static readonly type = "冰雪飞花";
  static readonly 弱字根列表: string[] = ["又"];
  private 分析器: 冰雪飞花分析器;

  constructor(配置: 字形分析配置) {
    super(配置);
    this.分析器 = 冰雪飞花分析器.创建(配置);
  }

  查找动态部件全集合分析结果(部件: 部件) {
    return (this.查找动态部件分析结果(部件) as any)
      .__magic as 优先表<默认部件分析>;
  }

  是小集合字根(复合体: 复合体) {
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined && this.分析器.当前在小集合(字根)) return 字根;
  }

  取全集合首根和余部(字形: 字形): 冰雪飞花部分信息 {
    let 当前字形 = 字形;
    while (!是部件(当前字形)) {
      const 字根 = this.配置.复合体字根映射.get(当前字形);
      if (字根 !== undefined && this.配置.字根决策.has(字根)) {
        return {
          部分: 字形,
          是单字根: 当前字形 === 字形,
          首根: 字根,
        };
      } else {
        当前字形 = 当前字形.按首笔排序部分()[0]!;
      }
    }
    const 部件分析结果 = this.查找部件分析结果(当前字形);
    if (部件分析结果 === undefined)
      throw new Error(`部件 ${字形.字符} 没有分析结果`);
    return {
      部分: 字形,
      是单字根: 当前字形 === 字形 && 部件分析结果.全集合字根序列.length === 1,
      首根: 部件分析结果.全集合字根序列[0]!,
    };
  }

  取余部(字形列表: 字形[]): 字根[] {
    if (字形列表.length >= 2) {
      const [第一部, 第二部] = 字形列表;
      const 第一部字根 = this.取小集合首根(第一部!);
      const 第二部字根 = this.取小集合首根(第二部!);
      return [第一部字根, 第二部字根];
    } else if (字形列表.length === 1) {
      const 字形 = 字形列表[0]!;
      if (是部件(字形)) {
        const 部件分析结果 = this.查找部件分析结果(字形);
        if (部件分析结果 === undefined)
          throw new Error(`部件 ${字形.字符} 没有分析结果`);
        return 部件分析结果.字根序列.slice(0, 2);
      } else {
        const 字根 = this.是小集合字根(字形);
        if (字根) return [字根];
        return this.取余部(字形.按首笔排序部分());
      }
    } else {
      throw new Error("没有余部");
    }
  }

  取小集合首根(字形: 字形): 字根 {
    let 当前字形 = 字形;
    while (!是部件(当前字形)) {
      const 字根 = this.是小集合字根(当前字形);
      if (字根) return 字根;
      当前字形 = 当前字形.按首笔排序部分()[0]!;
    }
    const 部件分析结果 = this.查找部件分析结果(当前字形);
    if (部件分析结果 === undefined)
      throw new Error(`部件 ${字形.字符} 没有分析结果`);
    return 部件分析结果.字根序列[0]!;
  }

  动态取全集合首根(字形: 字形): 带条件<冰雪飞花部分信息>[] {
    const 主部优先表: 带条件<冰雪飞花部分信息>[] = [];
    let 当前字形 = 字形;
    while (!是部件(当前字形)) {
      const 字根 = this.配置.复合体字根映射.get(当前字形);
      if (字根 !== undefined) {
        const 可选 = this.分析器.可选字根.has(字根);
        主部优先表.push({
          部分: 字形,
          是单字根: 当前字形 === 字形,
          首根: 字根,
          条件列表: 可选 ? [存在(字根)] : [],
        });
        if (!可选) {
          return 主部优先表;
        }
      } else {
        当前字形 = 当前字形.按首笔排序部分()[0]!;
      }
    }
    const 部件分析结果优先表 = this.查找动态部件全集合分析结果(当前字形)!;
    for (const 部件分析结果 of 部件分析结果优先表) {
      主部优先表.push({
        部分: 字形,
        是单字根: 当前字形 === 字形 && 部件分析结果.字根序列.length === 1,
        首根: 部件分析结果.字根序列[0]!,
        条件列表: 部件分析结果.条件列表,
      });
    }
    return 主部优先表;
  }

  动态取余部(字形列表: 字形[]): 带条件<{ 字根列表: 字根[] }>[] {
    if (字形列表.length >= 2) {
      const [第一部, 第二部] = 字形列表;
      const 第一部列表 = this.动态取小集合首根(第一部!);
      const 第二部列表 = this.动态取小集合首根(第二部!);
      return 贝叶斯推断(
        [第一部列表, 第二部列表],
        ([第一部信息, 第二部信息]) => {
          const 字根列表 = [第一部信息!.字根, 第二部信息!.字根];
          return { 字根列表 };
        },
      );
    } else if (字形列表.length === 1) {
      const 字形 = 字形列表[0]!;
      if (是部件(字形)) {
        const 部件分析结果列表 = this.查找动态部件分析结果(字形)!;
        return [...部件分析结果列表].map((部件分析结果) => ({
          字根列表: 部件分析结果.字根序列.slice(0, 2),
          条件列表: 部件分析结果.条件列表,
        }));
      } else {
        const 结果列表: 带条件<{ 字根列表: 字根[] }>[] = [];
        const 字根 = this.配置.复合体字根映射.get(字形);
        if (字根) {
          const 可选 = this.分析器.可选字根与必要一般字根.has(字根);
          结果列表.push({
            字根列表: [字根],
            条件列表: 可选 ? [this.分析器.在小集合(字根)] : [],
          });
          if (!可选) return 结果列表;
        }
        结果列表.push(...this.动态取余部(字形.按首笔排序部分()));
        return 结果列表;
      }
    } else {
      throw new Error("没有余部");
    }
  }

  动态取小集合首根(字形: 字形): 带条件<{ 字根: 字根 }>[] {
    const 结果列表: 带条件<{ 字根: 字根 }>[] = [];
    let 当前字形 = 字形;
    while (!是部件(当前字形)) {
      const 字根 = this.配置.复合体字根映射.get(当前字形);
      if (字根) {
        const 可选 = this.分析器.可选字根与必要一般字根.has(字根);
        结果列表.push({
          字根,
          条件列表: 可选 ? [this.分析器.在小集合(字根)] : [],
        });
        if (!可选) return 结果列表;
      }
      当前字形 = 当前字形.按首笔排序部分()[0]!;
    }
    const 部件分析结果列表 = this.查找动态部件分析结果(当前字形)!;
    if (部件分析结果列表 === undefined)
      throw new Error(`部件 ${字形.字符} 没有分析结果`);
    for (const 部件分析结果 of 部件分析结果列表) {
      结果列表.push({
        字根: 部件分析结果.字根序列[0]!,
        条件列表: 部件分析结果.条件列表,
      });
    }
    return 结果列表;
  }

  组合逻辑(
    复合体: 复合体,
    首部信息: 冰雪飞花部分信息,
    末部信息: 冰雪飞花部分信息,
  ) {
    let 部首取法: "首" | "末";
    const 是包围结构 = /[⿴⿵⿶⿷⿸⿹⿺⿼⿽⿻]/.test(复合体.结构描述字符);
    const 是准包围结构 = [0x1].includes(首部信息.部分.字符.toNumber());
    // 包围结构二择一：外部是字根就一定取外部，不是就一定取内部
    if (是包围结构 || 是准包围结构) {
      let 外部信息: 冰雪飞花部分信息;
      let 外部: "首" | "末", 内部: "首" | "末";
      if (复合体.部分列表[0] === 首部信息.部分) {
        外部信息 = 首部信息;
        外部 = "首";
        内部 = "末";
      } else {
        外部信息 = 末部信息;
        外部 = "末";
        内部 = "首";
      }
      if (外部信息.是单字根) 部首取法 = 外部;
      else 部首取法 = 内部;
    } else {
      if (首部信息.是单字根 && 末部信息.是单字根) {
        const 特取字 =
          "刈划刖列刘刮劝功孜对忌悲戏戕改攻敉敌敲斐斧欢欣欲歆汞畋瞽紊翔翡翮致蜚裴观贡败赦辈邓邛邝邯邺郅郝难雀雉靓项顺须顼颀颇飒鸡鸹鹆鹘";
        部首取法 = 特取字.includes(复合体.字符.获取名称()) ? "末" : "首";
      } else if (首部信息.是单字根) {
        部首取法 = "首";
      } else if (末部信息.是单字根) {
        部首取法 = "末";
      } else {
        部首取法 = "首";
      }
    }
    return 部首取法;
  }

  分析(复合体: 复合体) {
    const 分析: 冰雪飞花复合体分析 = {
      类型: "复合体",
      复合体,
      字根序列: [],
      余部: [],
    };
    const 字根 = this.是小集合字根(复合体);
    if (字根 !== undefined) {
      分析.余部.push(字根);
    } else {
      const 按首笔排序列表 = 复合体.按首笔排序部分();
      const 首部 = 按首笔排序列表[0]!;
      const 末部 = 按首笔排序列表.at(-1)!;
      const 首部信息 = this.取全集合首根和余部(首部);
      const 末部信息 = this.取全集合首根和余部(末部);
      const 取法 = this.组合逻辑(复合体, 首部信息, 末部信息);
      let 部首: 字根, 余部: 字根[];
      if (取法 === "首") {
        部首 = 首部信息.首根;
        余部 = this.取余部(按首笔排序列表.slice(1));
      } else {
        部首 = 末部信息.首根;
        余部 = this.取余部(按首笔排序列表.slice(0, -1));
      }
      分析.部首 = 部首;
      分析.余部.push(...余部);
    }
    if (分析.部首) 分析.字根序列.push(分析.部首);
    分析.字根序列.push(...分析.余部);
    return ok(分析);
  }

  动态分析(复合体: 复合体) {
    const 分析列表: 带条件<冰雪飞花复合体分析>[] = [];
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      const 可选 = this.分析器.可选字根与必要一般字根.has(字根);
      分析列表.push({
        类型: "复合体",
        复合体,
        字根序列: [字根],
        余部: [字根],
        条件列表: 可选 ? [this.分析器.在小集合(字根)] : [],
      });
      if (!可选) return ok(new 优先表(分析列表));
    }
    const 按首笔排序列表 = 复合体.按首笔排序部分();
    const 首部 = 按首笔排序列表[0]!;
    const 末部 = 按首笔排序列表.at(-1)!;
    const 首部信息列表: 带条件<冰雪飞花部分信息>[] =
      this.动态取全集合首根(首部);
    const 末部信息列表: 带条件<冰雪飞花部分信息>[] =
      this.动态取全集合首根(末部);
    for (const 首部信息 of 首部信息列表) {
      for (const 末部信息 of 末部信息列表) {
        const 合并条件列表 = [...首部信息.条件列表, ...末部信息.条件列表];
        const 取法 = this.组合逻辑(复合体, 首部信息, 末部信息);
        let 部首: 字根, 余部: 带条件<{ 字根列表: 字根[] }>[];
        if (取法 === "首") {
          部首 = 首部信息.首根;
          余部 = this.动态取余部(按首笔排序列表.slice(1));
        } else {
          部首 = 末部信息.首根;
          余部 = this.动态取余部(按首笔排序列表.slice(0, -1));
        }
        for (const { 字根列表, 条件列表 } of 余部) {
          const 分析: 带条件<冰雪飞花复合体分析> = {
            类型: "复合体",
            复合体,
            字根序列: [部首, ...字根列表],
            部首,
            余部: 字根列表,
            条件列表: 合并条件列表.concat(条件列表),
          };
          分析列表.push(分析);
        }
      }
    }
    return ok(new 优先表(分析列表));
  }
}

export type { 冰雪飞花复合体分析, 复合体分析器, 星空键道复合体分析 };
export {
  二笔复合体分析器,
  冰雪飞花复合体分析器,
  复合体,
  张码复合体分析器,
  星空键道复合体分析器,
  真码复合体分析器,
  逸码复合体分析器,
  首右复合体分析器,
  首末取大复合体分析器,
  默认复合体分析器,
};
