import { range, sortBy } from "lodash-es";
import {
  type 张码部件分析,
  计算张码补码,
  type 逸码拆分方式,
  type 逸码部件分析,
  type 默认部件分析,
} from "./component.js";
import type { 复合体数据, 结构表示符 } from "./data.js";
import type { 基本分析, 字形分析配置 } from "./repertoire.js";
import { default_err, ok, type Result } from "./utils.js";

interface 复合体分析器<
  部件分析 extends 基本分析 = 基本分析,
  复合体分析 extends 基本分析 = 基本分析,
> {
  /**
   * 对复合体进行拆分
   *
   * @param 名称 复合体名称
   * @param 复合体 复合体字形数据
   * @param 部分分析列表 复合体各部分的拆分结果列表
   */
  分析(
    名称: string,
    复合体: 复合体数据,
    部分分析列表: (部件分析 | 复合体分析)[],
  ): Result<复合体分析, Error>;

  动态分析?(
    名称: string,
    复合体: 复合体数据,
    部分分析列表: (部件分析[] | 复合体分析[])[],
  ): Result<复合体分析[], Error>;
}

type 默认混合分析 = 默认部件分析 | 基本分析;

function 按笔顺组装(
  字根序列列表: string[][],
  部分分析列表: 默认混合分析[],
  glyph: 复合体数据,
): string[] {
  if (glyph.order === undefined) return 字根序列列表.flat();
  const 字根序列: string[] = [];
  const 剩余部分结果 = 字根序列列表.map((x) => ({
    剩余序列: x.slice(),
    已取笔画数: 0,
  }));
  for (const { index, strokes } of glyph.order) {
    const 剩余部分 = 剩余部分结果[index];
    const 部分名称 = glyph.operandList[index];
    if (部分名称 === undefined || 剩余部分 === undefined) continue; // 忽略无效部分
    const 部件分析 = 部分分析列表[index];
    if (
      strokes === 0 ||
      部件分析 === undefined ||
      !("当前拆分方式" in 部件分析)
    ) {
      字根序列.push(...剩余部分.剩余序列);
      剩余部分.剩余序列 = [];
    } else {
      const { 当前拆分方式 } = 部件分析;
      const toTake = 当前拆分方式.拆分方式.filter(
        (x) =>
          x.笔画索引[0]! >= 剩余部分.已取笔画数 &&
          x.笔画索引[0]! <= 剩余部分.已取笔画数 + strokes - 1,
      ).length;
      字根序列.push(...剩余部分.剩余序列.slice(0, toTake));
      剩余部分.剩余序列 = 剩余部分.剩余序列.slice(toTake);
      剩余部分.已取笔画数 += strokes;
    }
  }
  return 字根序列;
}

class 默认复合体分析器 implements 复合体分析器<默认部件分析> {
  static readonly type = "默认";
  constructor(private config: 字形分析配置) {}

  分析(名称: string, 复合体: 复合体数据, 部分分析列表: 默认混合分析[]) {
    if (this.config.字根决策.has(名称)) return ok({ 字根序列: [名称] });
    const 全部字根 = 部分分析列表.map((x) => x.字根序列);
    return ok({ 字根序列: 按笔顺组装(全部字根, 部分分析列表, 复合体) });
  }
}

class 真码复合体分析器 implements 复合体分析器<默认部件分析> {
  static readonly type = "真码";
  constructor(private config: 字形分析配置) {}

  分析(名称: string, 复合体: 复合体数据, 部分分析列表: 默认混合分析[]) {
    if (this.config.字根决策.has(名称)) return ok({ 字根序列: [名称] });
    const 字根序列: string[] = [];
    if (复合体.operator === "⿶") {
      // 下包围结构优先取内部
      字根序列.push(...部分分析列表[1]!.字根序列);
      字根序列.push(...部分分析列表[0]!.字根序列);
    } else {
      部分分析列表.map((x) => 字根序列.push(...x.字根序列));
    }
    return ok({ 字根序列 });
  }
}

function 按首笔排序<T>(部分结果: T[], glyph: 复合体数据): T[] {
  if (glyph.order === undefined) return 部分结果;
  const orderedResults = sortBy(range(部分结果.length), (i) =>
    glyph.order!.findIndex((b) => b.index === i),
  ).map((i) => 部分结果[i]!);
  return orderedResults;
}

interface 分部取码复合体分析 extends 基本分析 {
  完整字根序列: string[];
}

type 首右分析 = 默认部件分析 | 分部取码复合体分析;

class 首右复合体分析器
  implements 复合体分析器<默认部件分析, 分部取码复合体分析>
{
  static readonly type = "首右";
  constructor(private config: 字形分析配置) {}

  get(x: 首右分析) {
    return "完整字根序列" in x ? x.完整字根序列 : x.字根序列;
  }

  分析(名称: string, 复合体: 复合体数据, 部分分析列表: 分部取码复合体分析[]) {
    if (this.config.字根决策.has(名称)) {
      return ok({ 字根序列: [名称], 完整字根序列: [名称] });
    }
    const [第一部, 第二部] = 按首笔排序(部分分析列表, 复合体);
    if (!第一部 || !第二部) return default_err(`${名称} 缺少部分`);
    const 全部字根 = 部分分析列表.map((x) => x.字根序列);
    const 完整字根序列 = 按笔顺组装(全部字根, 部分分析列表, 复合体);
    const 字根序列: string[] = /[⿰⿲]/.test(复合体.operator)
      ? [this.get(第一部)[0]!, this.get(第二部)[0]!]
      : [完整字根序列[0]!, 完整字根序列.at(-1)!];
    return ok({ 字根序列, 完整字根序列 });
  }
}

class 二笔复合体分析器 implements 复合体分析器 {
  static readonly type = "二笔";
  constructor(private 配置: 字形分析配置) {}

  分析(名称: string, 复合体: 复合体数据, 部分分析列表: 默认混合分析[]) {
    if (this.配置.字根决策.has(名称)) return ok({ 字根序列: [名称] });
    const 字根序列: string[] = [];
    const 排序部分结果 = 按首笔排序(部分分析列表, 复合体);
    for (const [index, part] of 排序部分结果.entries()) {
      if (index === 排序部分结果.length - 1) 字根序列.push(...part.字根序列);
      else 字根序列.push(part.字根序列[0]!);
    }
    return ok({ 字根序列 });
  }
}

interface 星空键道复合体分析 extends 基本分析 {
  首部字根序列: string[];
  余部字根序列: string[];
}

type 星空键道分析 = 默认部件分析 | 星空键道复合体分析;

class 星空键道复合体分析器
  implements 复合体分析器<默认部件分析, 星空键道复合体分析>
{
  static readonly type = "星空键道";
  constructor(private 配置: 字形分析配置) {}

  分析(名称: string, 复合体: 复合体数据, 部分分析列表: 星空键道分析[]) {
    if (this.配置.字根决策.has(名称)) {
      return ok({
        字根序列: [名称],
        首部字根序列: [],
        余部字根序列: [],
      });
    }
    const 字根序列 = 按笔顺组装(
      部分分析列表.map((x) => x.字根序列),
      部分分析列表,
      复合体,
    );
    const 首部字根序列: string[] = [];
    const 余部字根序列: string[] = [];
    if (复合体.order?.[0]?.index === 1) {
      // 第一个书写的部分只写了一笔，视同独体字取码
    } else {
      const 排序部分结果 = 按首笔排序(部分分析列表, 复合体);
      for (const [index, part] of 排序部分结果.entries()) {
        if (index === 0) {
          首部字根序列.push(...part.字根序列);
        } else {
          余部字根序列.push(...part.字根序列);
        }
      }
    }
    return ok({ 字根序列, 首部字根序列, 余部字根序列 });
  }
}

interface 张码复合体分析 extends 分部取码复合体分析 {
  完整字根序列: string[];
  结构符: 结构表示符;
  部分分析列表: 张码分析[];
  补码: [string];
  为准码元: ["false"];
}

type 张码分析 = 张码部件分析 | 张码复合体分析;

class 张码复合体分析器 implements 复合体分析器<张码部件分析, 张码复合体分析> {
  static readonly type = "张码";
  constructor(private 配置: 字形分析配置) {}

  get(x: 张码分析) {
    return "完整字根序列" in x ? x.完整字根序列 : x.字根序列;
  }

  分析(名称: string, 复合体: 复合体数据, 部分分析列表: 张码分析[]) {
    const 字根序列: string[] = [];
    const 完整字根序列: string[] = [];
    if (this.配置.字根决策.has(名称)) {
      字根序列.push(名称);
      完整字根序列.push(名称);
    } else {
      if (
        复合体.operator === "⿶" ||
        (复合体.operator === "⿺" && 复合体.operandList[0] === "\ue09d")
      ) {
        for (const part of 部分分析列表.reverse())
          完整字根序列.push(...this.get(part));
      } else {
        for (const part of 部分分析列表) 完整字根序列.push(...this.get(part));
      }
      const 展开部分分析列表 = this.展开嵌套上下和左右结构(
        部分分析列表,
        复合体.operator,
      );
      const 取码结果 = /[⿱⿳]/.test(复合体.operator)
        ? this.上下结构取码规则(展开部分分析列表)
        : /[⿰⿲]/.test(复合体.operator)
          ? this.左右结构取码规则(展开部分分析列表)
          : [...完整字根序列];
      字根序列.push(...取码结果);
    }
    const 补码 = 计算张码补码(字根序列, this.配置.字根笔画映射);
    return ok({
      字根序列,
      完整字根序列,
      结构符: 复合体.operator,
      部分分析列表,
      补码: [补码] as [string],
      为准码元: ["false"] as ["false"],
    });
  }

  展开嵌套上下和左右结构(部分分析列表: 张码分析[], 操作符: 结构表示符) {
    if (部分分析列表.length !== 2 || !/[⿰⿱]/.test(操作符))
      return 部分分析列表;
    const 展开后: 张码分析[] = [];
    const regex = 操作符 === "⿰" ? /[⿰⿲]/ : /[⿱⿳]/;
    for (const 部分分析 of 部分分析列表) {
      if (
        展开后.length < 2 &&
        "结构符" in 部分分析 &&
        regex.test(部分分析.结构符)
      ) {
        展开后.push(...部分分析.部分分析列表);
      } else {
        展开后.push(部分分析);
      }
    }
    return 展开后;
  }

  寻找叠眼及其索引(部分分析列表: 张码分析[]) {
    const index = 部分分析列表.findIndex(
      (x) => "结构符" in x && /[⿰⿲]/.test(x.结构符),
    );
    return [部分分析列表.at(index)! as 张码复合体分析, index] as const;
  }

  上下结构取码规则(部分分析列表: 张码分析[]) {
    const 字根序列: string[] = [];
    const [叠眼, 叠眼索引] = this.寻找叠眼及其索引(部分分析列表);
    const 叠眼以上序列: string[] = [];
    switch (叠眼索引) {
      case -1: // 没有叠眼
        for (const 部分分析 of 部分分析列表)
          字根序列.push(...this.get(部分分析));
        break;
      case 0: // 叠眼在开头
        // 先取叠眼各部分的首根
        for (const 部分分析 of 叠眼.部分分析列表)
          字根序列.push(this.get(部分分析)[0]!);
        // 然后取剩余部分的首根和末根
        if (部分分析列表.length > 2) {
          字根序列.push(this.get(部分分析列表[1]!)[0]!);
          字根序列.push(this.get(部分分析列表.at(-1)!).at(-1)!);
        } else {
          字根序列.push(...this.首末(this.get(部分分析列表[1]!)));
        }
        break;
      default: // 叠眼在中间或末尾
        // 叠眼以上，最多可顺序取两根
        for (let index = 0; index < 叠眼索引; ++index) {
          叠眼以上序列.push(...this.get(部分分析列表[index]!));
        }
        字根序列.push(...叠眼以上序列.slice(0, 2));
        if (叠眼索引 + 1 < 部分分析列表.length) {
          // 叠眼在中间时：
          // 如果已取两根，则取叠眼首根和叠眼以下的末根
          // 如果只取了一根，则取叠眼第一部分的首根、叠眼最后一部分的首根、叠眼以下的末根
          字根序列.push(this.get(叠眼.部分分析列表[0]!).at(0)!);
          if (字根序列.length === 2) {
            字根序列.push(this.get(叠眼.部分分析列表.at(-1)!).at(0)!);
          }
          字根序列.push(this.get(部分分析列表.at(-1)!).at(-1)!);
        } else {
          // 叠眼在末尾时：按正常顺序取根
          字根序列.push(...this.get(叠眼));
        }
    }
    return 字根序列;
  }

  左右结构取码规则(部分分析列表: 张码分析[]) {
    const 字根序列: string[] = [];
    const 左部 = 部分分析列表[0]!;
    let 左部是眼叠 = false;
    if ("结构符" in 左部 && /[⿱⿳]/.test(左部.结构符)) {
      // 左部是叠型
      const [叠眼, 叠眼索引] = this.寻找叠眼及其索引(左部.部分分析列表);
      switch (叠眼索引) {
        case -1: // 没有叠眼
          break;
        case 0: // 叠眼在开头
          左部是眼叠 = true;
          // 取左部叠眼首部分和末部分的首根
          字根序列.push(this.get(叠眼.部分分析列表[0]!)[0]!);
          字根序列.push(this.get(叠眼.部分分析列表.at(-1)!)[0]!);
          // 取左部剩余部分的末根
          字根序列.push(this.get(左部.部分分析列表.at(-1)!)[0]!);
          break;
        default: // 叠眼在中间或末尾
          左部是眼叠 = true;
          // 取叠眼以上部分的首根
          字根序列.push(this.get(左部.部分分析列表[0]!)[0]!);
          // 取叠眼首部分的首根
          字根序列.push(this.get(叠眼.部分分析列表[0]!)[0]!);
          // 叠眼在末尾时，取叠眼末部分的末根
          if (叠眼索引 === 左部.部分分析列表.length - 1)
            字根序列.push(this.get(叠眼.部分分析列表.at(-1)!).at(-1)!);
          // 叠眼在中间时，取左部末部分的末根
          else 字根序列.push(this.get(左部.部分分析列表.at(-1)!).at(-1)!);
      }
    }
    if (左部是眼叠) {
      // 已经处理完左部，直接取右部末码即可
      字根序列.push(this.get(部分分析列表.at(-1)!).at(-1)!);
    } else {
      // 一般情况，左部、中部最多各取首尾两根
      let 余部开始索引 = 1;
      字根序列.push(...this.首末(this.get(左部)));
      if (部分分析列表.length > 2) {
        字根序列.push(...this.首末(this.get(部分分析列表[1]!)));
        余部开始索引 = 2;
      }
      // 如果左部和中部已经有 4 根，舍弃一根
      if (字根序列.length === 4) 字根序列.pop();
      for (const 部分分析 of 部分分析列表.slice(余部开始索引)) {
        字根序列.push(...this.get(部分分析));
      }
    }
    return 字根序列;
  }

  首末(x: string[]) {
    return x.length === 1 ? x : [x[0]!, x.at(-1)!];
  }
}

class 逸码复合体分析器 implements 复合体分析器<逸码部件分析, 逸码部件分析> {
  static readonly type = "逸码";
  constructor(private 配置: 字形分析配置) {}

  分析(名称: string, 复合体: 复合体数据, 部分分析列表: 逸码部件分析[]) {
    if (this.配置.字根决策.has(名称)) {
      const 笔画序列 = this.配置.字根笔画映射.get(名称) ?? [];
      const 余二拆分方式: 逸码拆分方式 = {
        字根: [名称],
        补码: 笔画序列.map((x) => `${x}0`),
      };
      while (余二拆分方式.补码.length < 6) {
        余二拆分方式.补码.push(余二拆分方式.补码.at(-1)!);
      }
      const 余一拆分方式 = structuredClone(余二拆分方式);
      const 笔画拆分方式: 逸码拆分方式 = {
        字根: 笔画序列.map((x) => `${x}0`),
        补码: Array(6)
          .fill(笔画序列.at(-1)!)
          .map((x) => `${x}0`),
      };
      const 字根序列 = 余二拆分方式.字根.concat(余二拆分方式.补码);
      return ok({ 字根序列, 余二拆分方式, 余一拆分方式, 笔画拆分方式 });
    }
    const 余二拆分方式: 逸码拆分方式 = {
      字根: [],
      补码: [],
    };
    const 余一拆分方式: 逸码拆分方式 = {
      字根: [],
      补码: [],
    };
    const 笔画拆分方式: 逸码拆分方式 = {
      字根: [],
      补码: [],
    };
    const 排序部分结果 = 按首笔排序(部分分析列表, 复合体);
    const last = 排序部分结果.length - 1;
    for (const [i, 部分] of 排序部分结果.entries()) {
      // 0
      笔画拆分方式.字根.push(...部分.笔画拆分方式.字根);
      if (i === last) 笔画拆分方式.补码.push(...部分.笔画拆分方式.补码);
      // 1
      if (余一拆分方式.字根.length === 0) {
        余一拆分方式.字根.push(...部分.余一拆分方式.字根);
        if (i === last) 余一拆分方式.补码.push(...部分.余一拆分方式.补码);
      } else {
        余一拆分方式.字根.push(...部分.笔画拆分方式.字根);
        if (i === last) 余一拆分方式.补码.push(...部分.笔画拆分方式.补码);
      }
      // 2
      if (余二拆分方式.字根.length === 0) {
        余二拆分方式.字根.push(...部分.余二拆分方式.字根);
        if (i === last) 余二拆分方式.补码.push(...部分.余二拆分方式.补码);
      } else if (余二拆分方式.字根.length === 1) {
        余二拆分方式.字根.push(...部分.余一拆分方式.字根);
        if (i === last) 余二拆分方式.补码.push(...部分.余一拆分方式.补码);
      } else {
        余二拆分方式.字根.push(...部分.笔画拆分方式.字根);
        if (i === last) 余二拆分方式.补码.push(...部分.笔画拆分方式.补码);
      }
    }
    const 字根序列 = 余二拆分方式.字根.concat(余二拆分方式.补码);
    return ok({ 字根序列, 余二拆分方式, 余一拆分方式, 笔画拆分方式 });
  }
}

export {
  二笔复合体分析器,
  张码复合体分析器,
  逸码复合体分析器,
  星空键道复合体分析器,
  真码复合体分析器,
  首右复合体分析器,
  默认复合体分析器,
  按首笔排序,
};
export type {
  分部取码复合体分析,
  复合体分析器,
  星空键道复合体分析,
  默认混合分析,
};

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
