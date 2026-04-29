import { range, sortBy } from "lodash-es";
import type { 分类器, 笔画名称 } from "./classifier.js";
import {
  type 张码部件分析,
  计算张码补码,
  type 逸码部件分析,
  部件,
  type 默认部件分析,
} from "./component.js";
import type { 笔画块, 结构描述字符 } from "./data.js";
import { 二笔 } from "./element.js";
import {
  type 基本分析,
  type 基本复合体分析,
  type 字形,
  type 字形分析配置,
  type 字根,
  是复合体,
  是部件,
} from "./repertoire.js";
import type { 字符 } from "./unicode.js";
import {
  default_err,
  ok,
  type Result,
  排列组合,
  type 源标签集合,
} from "./utils.js";

class 复合体 {
  private 笔画列表: 笔画名称[];

  constructor(
    public 字符: 字符,
    public 标签集合: 源标签集合,
    public 用户自定义: boolean,
    public 结构描述字符: 结构描述字符,
    public 部分列表: 字形[],
    public 笔顺: 笔画块[],
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
  计算笔画列表(笔顺: 笔画块[], 部分列表: 字形[]): 笔画名称[] {
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

abstract class 复合体分析器<
  部件分析 extends 基本分析 = 基本分析,
  复合体分析 extends 基本分析 = 基本分析,
> {
  public 部件分析结果: Map<部件, 部件分析> = new Map();
  public 动态部件分析结果: Map<部件, 部件分析[]> = new Map();

  constructor(protected 配置: 字形分析配置) {}

  查找部件分析结果(部件: 部件): 部件分析 | undefined {
    return this.部件分析结果.get(部件);
  }

  查找动态部件分析结果(部件: 部件): 部件分析[] | undefined {
    return this.动态部件分析结果.get(部件);
  }

  顺序取根(字形: 字形): 字根[] {
    if (是部件(字形)) return this.查找部件分析结果(字形)!.字根序列;
    const 字根 = this.配置.复合体字根映射.get(字形);
    if (字根 !== undefined) return [字根];
    const 部分结果列表 = 字形.部分列表.map((子字形) => {
      let 字根序列: 字根[];
      let 部件分析: 部件分析 | undefined;
      if (是部件(子字形)) {
        部件分析 = this.查找部件分析结果(子字形);
        字根序列 = 部件分析!.字根序列;
      } else 字根序列 = this.顺序取根(子字形);
      return { 字根序列, 部件分析 };
    });
    return this.执行笔顺(部分结果列表, 字形.笔顺);
  }

  动态顺序取根(字形: 字形): 字根[][] {
    if (是部件(字形)) {
      return this.查找动态部件分析结果(字形)!.map((x) => x.字根序列);
    }
    const 部分结果组列表 = 字形.部分列表.map((子字形) => {
      const 部分结果组 = [];
      if (是部件(子字形)) {
        for (const 分析 of this.查找动态部件分析结果(子字形)!) {
          部分结果组.push({ 字根序列: 分析.字根序列, 部件分析: 分析 });
        }
      } else {
        const 动态结果 = this.动态顺序取根(子字形);
        for (const 字根序列 of 动态结果) {
          部分结果组.push({ 字根序列, 部件分析: undefined });
        }
      }
      return 部分结果组;
    });
    const 结果组: 字根[][] = [];
    for (const 组合 of 排列组合(部分结果组列表)) {
      结果组.push(this.执行笔顺(组合, 字形.笔顺));
    }
    return 结果组;
  }

  执行笔顺(
    部分结果列表: {
      字根序列: 字根[];
      部件分析?: 部件分析;
    }[],
    笔顺: 笔画块[],
  ): 字根[] {
    const 已取笔画数列表 = 部分结果列表.map(() => 0);
    const 字根序列: 字根[] = [];
    for (const { index, strokes } of 笔顺) {
      const 剩余部分 = 部分结果列表[index];
      if (剩余部分 === undefined) continue; // 忽略无效部分
      const 部件分析 = 剩余部分.部件分析;
      if (
        strokes === 0 ||
        部件分析 === undefined ||
        !("当前拆分方式" in 部件分析)
      ) {
        字根序列.push(...剩余部分.字根序列);
        剩余部分.字根序列 = [];
      } else {
        const { 当前拆分方式 } = 部件分析 as any as 默认部件分析;
        const toTake = 当前拆分方式.拆分方式.filter(
          (x) =>
            x.笔画索引[0]! >= 已取笔画数列表[index]! &&
            x.笔画索引[0]! <= 已取笔画数列表[index]! + strokes - 1,
        ).length;
        字根序列.push(...剩余部分.字根序列.slice(0, toTake));
        剩余部分.字根序列 = 剩余部分.字根序列.slice(toTake);
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
  动态分析(_: 复合体): Result<复合体分析[], Error> {
    return default_err("动态分析未实现");
  }
}

export interface 默认复合体分析 extends 基本复合体分析 {
  结构: 结构描述字符;
}

class 默认复合体分析器 extends 复合体分析器<默认部件分析, 默认复合体分析> {
  static readonly type = "默认";

  分析(复合体: 复合体) {
    const 分析: 默认复合体分析 = {
      类型: "复合体",
      复合体,
      结构: 复合体.结构描述字符,
      字根序列: [],
    };
    分析.字根序列.push(...this.顺序取根(复合体));
    return ok(分析);
  }

  动态分析(复合体: 复合体) {
    const 结果列表: 默认复合体分析[] = [];
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      结果列表.push({
        类型: "复合体",
        复合体,
        字根序列: [字根],
        结构: 复合体.结构描述字符,
      });
      if (!this.配置.可选字根.has(字根)) return ok(结果列表);
    }
    for (const 字根序列 of this.动态顺序取根(复合体)) {
      结果列表.push({
        类型: "复合体",
        复合体,
        字根序列,
        结构: 复合体.结构描述字符,
      });
    }
    return ok(结果列表);
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
    if (字根 !== undefined) {
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
}

class 二笔复合体分析器 extends 复合体分析器 {
  static readonly type = "二笔";

  取首根(字形: 字形): 字根 {
    if (是部件(字形)) {
      return this.查找部件分析结果(字形)!.字根序列[0]!;
    } else {
      const 第一部 = 字形.按首笔排序部分()[0]!;
      return this.取首根(第一部);
    }
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
        const [第二部之一, 第二部之二] = 第二部.按首笔排序部分();
        if (!第二部之一 || !第二部之二)
          return default_err(`${复合体.字符} 缺少部分`);
        分析.字根序列.push(this.取首根(第二部之一));
        分析.字根序列.push(this.取首根(第二部之二));
      }
    }
    return ok(分析);
  }

  动态分析(复合体: 复合体) {
    const 分析列表: 基本复合体分析[] = [];
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      const 是必要字根 =
        this.配置.字根决策.has(字根) && !this.配置.可选字根.has(字根);
      分析列表.push({ 类型: "复合体", 复合体, 字根序列: [字根] });
      if (!是必要字根) return ok(分析列表);
    }
    return ok(分析列表);
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
  补码: [string];
  为准码元: ["false"];
}

class 张码复合体分析器 extends 复合体分析器<张码部件分析, 张码复合体分析> {
  static readonly type = "张码";

  分析(复合体: 复合体) {
    const 分析: 张码复合体分析 = {
      类型: "复合体",
      复合体,
      字根序列: [],
      结构符: 复合体.结构描述字符,
      补码: [""],
      为准码元: ["false"],
    };
    const 字根 = this.配置.复合体字根映射.get(复合体);
    if (字根 !== undefined) {
      分析.字根序列.push(字根);
      return ok(分析);
    } else {
      const 展开部分列表 = this.展开嵌套上下和左右结构(复合体);
      if (/[⿱⿳]/.test(复合体.结构描述字符)) {
        分析.字根序列 = this.上下结构取码规则(展开部分列表);
      } else if (/[⿰⿲]/.test(复合体.结构描述字符)) {
        分析.字根序列 = this.左右结构取码规则(展开部分列表);
      } else {
        if (
          复合体.结构描述字符 === "⿶" ||
          (复合体.结构描述字符 === "⿺" &&
            复合体.部分列表[0]?.字符?.toNumber() === 0xe09d)
        ) {
          for (const part of [...复合体.部分列表].reverse())
            分析.字根序列.push(...this.顺序取根(part));
        } else {
          for (const part of 复合体.部分列表)
            分析.字根序列.push(...this.顺序取根(part));
        }
      }
    }
    分析.补码 = [
      计算张码补码(分析.字根序列, this.配置.分类器, 复合体.结构描述字符),
    ];
    return ok(分析);
  }

  展开嵌套上下和左右结构(复合体: 复合体) {
    if (复合体.部分列表.length !== 2 || !/[⿰⿱]/.test(复合体.结构描述字符))
      return 复合体.部分列表;
    const 展开后: 字形[] = [];
    const regex = 复合体.结构描述字符 === "⿰" ? /[⿰⿲]/ : /[⿱⿳]/;
    for (const 字形 of 复合体.部分列表) {
      if (展开后.length < 2 && !是部件(字形) && regex.test(字形.结构描述字符)) {
        展开后.push(...字形.部分列表);
      } else {
        展开后.push(字形);
      }
    }
    return 展开后;
  }

  寻找叠眼及其索引(部分列表: 字形[]) {
    const index = 部分列表.findIndex(
      (x) => !是部件(x) && /[⿰⿲]/.test(x.结构描述字符),
    );
    return [部分列表.at(index)! as 复合体, index] as const;
  }

  上下结构取码规则(部分列表: 字形[]) {
    const 字根序列: 字根[] = [];
    const [叠眼, 叠眼索引] = this.寻找叠眼及其索引(部分列表);
    const 叠眼以上序列: 字根[] = [];
    switch (叠眼索引) {
      case -1: // 没有叠眼
        for (const 字形 of 部分列表) 字根序列.push(...this.顺序取根(字形));
        break;
      case 0: // 叠眼在开头
        // 先取叠眼各部分的首根
        for (const 部分分析 of 叠眼.部分列表)
          字根序列.push(this.顺序取根(部分分析)[0]!);
        // 然后取剩余部分的首根和末根
        if (部分列表.length > 2) {
          字根序列.push(this.顺序取根(部分列表[1]!)[0]!);
          字根序列.push(this.顺序取根(部分列表.at(-1)!).at(-1)!);
        } else {
          字根序列.push(...this.首末(this.顺序取根(部分列表[1]!)));
        }
        break;
      default: // 叠眼在中间或末尾
        // 叠眼以上，最多可顺序取两根
        for (let index = 0; index < 叠眼索引; ++index) {
          叠眼以上序列.push(...this.顺序取根(部分列表[index]!));
        }
        字根序列.push(...叠眼以上序列.slice(0, 2));
        if (叠眼索引 + 1 < 部分列表.length) {
          // 叠眼在中间时：
          // 如果已取两根，则取叠眼首根和叠眼以下的末根
          // 如果只取了一根，则取叠眼第一部分的首根、叠眼最后一部分的首根、叠眼以下的末根
          字根序列.push(this.顺序取根(叠眼.部分列表[0]!).at(0)!);
          if (字根序列.length === 2) {
            字根序列.push(this.顺序取根(叠眼.部分列表.at(-1)!).at(0)!);
          }
          字根序列.push(this.顺序取根(部分列表.at(-1)!).at(-1)!);
        } else {
          // 叠眼在末尾时：按正常顺序取根
          字根序列.push(...this.顺序取根(叠眼));
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
      const [叠眼, 叠眼索引] = this.寻找叠眼及其索引(左部.部分列表);
      switch (叠眼索引) {
        case -1: // 没有叠眼
          break;
        case 0: // 叠眼在开头
          左部是眼叠 = true;
          // 取左部叠眼首部分和末部分的首根
          字根序列.push(this.顺序取根(叠眼.部分列表[0]!)[0]!);
          字根序列.push(this.顺序取根(叠眼.部分列表.at(-1)!)[0]!);
          // 取左部剩余部分的末根
          字根序列.push(this.顺序取根(左部.部分列表.at(-1)!)[0]!);
          break;
        default: // 叠眼在中间或末尾
          左部是眼叠 = true;
          // 取叠眼以上部分的首根
          字根序列.push(this.顺序取根(左部.部分列表[0]!)[0]!);
          // 取叠眼首部分的首根
          字根序列.push(this.顺序取根(叠眼.部分列表[0]!)[0]!);
          // 叠眼在末尾时，取叠眼末部分的末根
          if (叠眼索引 === 左部.部分列表.length - 1)
            字根序列.push(this.顺序取根(叠眼.部分列表.at(-1)!).at(-1)!);
          // 叠眼在中间时，取左部末部分的末根
          else 字根序列.push(this.顺序取根(左部.部分列表.at(-1)!).at(-1)!);
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

export {
  二笔复合体分析器,
  复合体,
  张码复合体分析器,
  星空键道复合体分析器,
  真码复合体分析器,
  逸码复合体分析器,
  首右复合体分析器,
  默认复合体分析器,
};
export type { 复合体分析器, 星空键道复合体分析 };

// const snow2Serializer = (operandResults, glyph) => {
//   const order =
//     glyph.order ?? glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
//   const sortedOperandResults = sortBy(range(operandResults.length), (i) =>
//     order.findIndex((b) => b.index === i),
//   ).map((i) => operandResults[i]!);
//   const first = sortedOperandResults[0]!;
//   const second = sortedOperandResults[1]!;
//   const marker =
//     first.full.length == 1
//       ? second.full.length == 1
//         ? "q"
//         : "e"
//       : second.full.length == 1
//         ? "w"
//         : "r";
//   const full = [first.字根序列[0]!, second.字根序列[0]!];
//   const sequence = [...full, marker];
//   return {
//     字根序列: sequence,
//     full,
//     结构符: glyph.operator,
//     部分结果: operandResults,
//   };
// };

// const feihuaSerializer = (operandResults, glyph, config) => {
//   const order =
//     glyph.order ?? glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
//   const sortedOperandResults = sortBy(range(operandResults.length), (i) =>
//     order.findIndex((b) => b.index === i),
//   ).map((i) => operandResults[i]!);
//   const sequence: string[] = [];
//   const first = sortedOperandResults[0]!;
//   const last = sortedOperandResults.at(-1)!;
//   const handleResidual = (sequence: string[], parts: 分析[]) => {
//     if (parts.length > 1) {
//       for (const x of parts) {
//         sequence.push(...x.full2[0]!);
//       }
//     } else {
//       const part = parts[0]!;
//       if ("operandResults" in part) {
//         for (const x of part.部分结果) {
//           sequence.push(...x.full2[0]!);
//         }
//       } else {
//         sequence.push(...part.full2);
//       }
//     }
//   };
//   if (
//     /[⿴⿵⿶⿷⿸⿹⿺⿼⿽⿻]/.test(glyph.operator) &&
//     "strokes" in operandResults[0]!
//   ) {
//     sequence.push(operandResults[0]!.full[0]!);
//     handleResidual(sequence, operandResults.slice(1));
//   } else if (
//     first.full.length === 1 &&
//     /[又]/.test(first.full[0]!) &&
//     last.full.length === 1
//   ) {
//     sequence.push(last.full[0]!);
//     handleResidual(sequence, sortedOperandResults.slice(0, -1));
//   } else if (first.full.length !== 1 && last.full.length === 1) {
//     sequence.push(last.full[0]!);
//     handleResidual(sequence, sortedOperandResults.slice(0, -1));
//   } else {
//     sequence.push(first.full[0]!);
//     handleResidual(sequence, sortedOperandResults.slice(1));
//   }
//   const full = sequentialSerializer(operandResults, glyph, config).full;
//   const backups = operandResults.map((x) => x.full);
//   operandResults.forEach((part) => {
//     part.full = [...part.full2];
//   });
//   const full2 = sequentialSerializer(operandResults, glyph, config).full;
//   operandResults.forEach((part, i) => {
//     part.full = backups[i];
//   });
//   return {
//     字根序列: sequence,
//     full,
//     full2,
//     结构符: glyph.operator,
//     部分结果: operandResults,
//   };
// };
// if (analysis.serializer === "feihua") {
//   for (const root of roots.keys()) {
//     // e43d: 全字头、e0e3: 乔字底、e0ba: 亦字底无八、e439: 见二、e431: 聿三、e020: 负字头、e078：卧人、e03e：尚字头、e42d：学字头、e07f：荒字底、e02a：周字框、e087：木无十、f001: 龰字底、e41a：三竖、e001: 两竖、e17e: 西字心
//     if (
//       !/[12345二\ue001三\ue41a口八丷\ue087宀日人\ue43d\uf001十乂亠厶冂\ue439\ue02a儿\ue17e\ue0e3\ue0ba大小\ue03e\ue442川彐\ue431\ue020\ue078\ue42d\ue07f]/.test(
//         root,
//       )
//     ) {
//       optionalRoots.add(root);
//     }
//   }
// }
