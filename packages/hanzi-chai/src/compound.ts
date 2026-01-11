import type { AnalysisConfig } from "./repertoire.js";
import type { 部件分析结果, 部件分析, 基本分析 } from "./component.js";
import type { Compound, Operator } from "./data.js";
import { range, sortBy } from "lodash-es";
import type { Result } from "./utils.js";

export interface 复合体分析 extends 基本分析 {}

type 分析 = 部件分析 | 复合体分析;

export type 复合体分析结果 = Map<string, 复合体分析 | 部件分析>;

export interface 复合体分析器 {
  /**
   * 对复合体进行拆分
   *
   * @param 字库 - 字符集
   * @param 复合体列表 - 待拆分复合体列表
   * @param 部件分析 - 部件拆分结果
   *
   * @returns 复合体拆分结果
   */
  分析(
    复合体映射: Map<string, Compound>,
    部件分析: 部件分析结果,
  ): Result<复合体分析结果>;
}

function 按笔顺组装(
  部分字根序列列表: string[][],
  glyph: Compound,
  部件分析结果: 部件分析结果,
): string[] {
  if (glyph.order === undefined) return 部分字根序列列表.flat();
  const 字根序列: string[] = [];
  const 剩余部分结果 = 部分字根序列列表.map((x) => ({
    剩余序列: x,
    已取笔画数: 0,
  }));
  for (const { index, strokes } of glyph.order) {
    const 剩余部分 = 剩余部分结果[index];
    const 部分名称 = glyph.operandList[index];
    if (部分名称 === undefined || 剩余部分 === undefined) continue; // 忽略无效部分
    const 部件分析 = 部件分析结果.get(部分名称);
    if (strokes === 0 || 部件分析 === undefined) {
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

class 默认复合体分析器 implements 复合体分析器 {
  static readonly type = "默认";
  constructor(private config: AnalysisConfig) {}

  分析(复合体映射: Map<string, Compound>, 部件分析: 部件分析结果) {
    const 复合体分析: 复合体分析结果 = new Map();
    for (const [字, 字形] of 复合体映射) {
      const 部分结果: 分析[] = [];
      for (const 部分 of 字形.operandList) {
        const result = 部件分析.get(部分) || 复合体分析.get(部分);
        if (result === undefined) return new Error();
        部分结果.push(result);
      }
      const 字根序列 = this.config.roots.has(字)
        ? [字]
        : 按笔顺组装(
            部分结果.map((x) => x.字根序列),
            字形,
            部件分析,
          );
      复合体分析.set(字, { 字根序列 });
    }
    return 复合体分析;
  }
}

class 真码复合体分析器 implements 复合体分析器 {
  static readonly type = "真码";
  constructor(private config: AnalysisConfig) {}

  分析(复合体映射: Map<string, Compound>, 部件分析: 部件分析结果) {
    const 复合体分析: 复合体分析结果 = new Map();
    for (const [字, 字形] of 复合体映射) {
      const 部分结果: 分析[] = [];
      for (const 部分 of 字形.operandList) {
        const result = 部件分析.get(部分) || 复合体分析.get(部分);
        if (result === undefined) return new Error();
        部分结果.push(result);
      }
      if (this.config.roots.has(字)) {
        复合体分析.set(字, { 字根序列: [字] });
        continue;
      }
      const 字根序列: string[] = [];
      if (字形.operator === "⿶") {
        // 下包围结构优先取内部
        字根序列.push(...部分结果[1]!.字根序列);
        字根序列.push(...部分结果[0]!.字根序列);
      } else {
        部分结果.map((x) => 字根序列.push(...x.字根序列));
      }
      复合体分析.set(字, { 字根序列 });
    }
    return 复合体分析;
  }
}

function 按首笔排序<T>(部分结果: T[], glyph: Compound): T[] {
  if (glyph.order === undefined) return 部分结果;
  const orderedResults = sortBy(range(部分结果.length), (i) =>
    glyph.order!.findIndex((b) => b.index === i),
  ).map((i) => 部分结果[i]!);
  return orderedResults;
}

interface 分部取码复合体分析 extends 复合体分析 {
  完整字根序列: string[];
}

class 首右复合体分析器 implements 复合体分析器 {
  static readonly type = "首右";
  constructor(private config: AnalysisConfig) {}

  分析(复合体映射: Map<string, Compound>, 部件分析: 部件分析结果) {
    type 首右分析 = 部件分析 | 分部取码复合体分析;
    const 复合体分析: Map<string, 首右分析> = new Map();
    const get = (x: 首右分析) =>
      "完整字根序列" in x ? x.完整字根序列 : x.字根序列;
    for (const [字, 字形] of 复合体映射) {
      const 部分结果: 首右分析[] = [];
      for (const 部分 of 字形.operandList) {
        const result = 部件分析.get(部分) || 复合体分析.get(部分);
        if (result === undefined) return new Error();
        部分结果.push(result);
      }
      if (this.config.roots.has(字)) {
        复合体分析.set(字, { 字根序列: [字], 完整字根序列: [字] });
        continue;
      }
      const [第一部, 第二部] = 按首笔排序(部分结果, 字形);
      const 完整字根序列 = 按笔顺组装(部分结果.map(get), 字形, 部件分析);
      const 字根序列: string[] = /[⿰⿲]/.test(字形.operator)
        ? [get(第一部)[0]!, get(第二部)[0]!]
        : [完整字根序列[0]!, 完整字根序列.at(-1)!];
      复合体分析.set(字, { 字根序列, 完整字根序列: 完整字根序列 });
    }
    return 复合体分析;
  }
}

class 二笔复合体分析器 implements 复合体分析器 {
  static readonly type = "二笔";
  constructor(private config: AnalysisConfig) {}

  分析(复合体映射: Map<string, Compound>, 部件分析: 部件分析结果) {
    const 复合体分析: Map<string, 分析> = new Map();
    for (const [字, 字形] of 复合体映射) {
      const 部分结果: 分析[] = [];
      for (const 部分 of 字形.operandList) {
        const result = 部件分析.get(部分) || 复合体分析.get(部分);
        if (result === undefined) return new Error();
        部分结果.push(result);
      }
      if (this.config.roots.has(字)) {
        复合体分析.set(字, { 字根序列: [字] });
        continue;
      }
      const 字根序列: string[] = [];
      const 排序部分结果 = 按首笔排序(部分结果, 字形);
      for (const [index, part] of 排序部分结果.entries()) {
        if (index === 排序部分结果.length - 1) 字根序列.push(...part.字根序列);
        else 字根序列.push(part.字根序列[0]!);
      }
      复合体分析.set(字, { 字根序列 });
    }
    return 复合体分析;
  }
}

interface 星空键道复合体分析 extends 复合体分析 {
  首部字根序列: string[];
  余部字根序列: string[];
}

class 星空键道复合体分析器 implements 复合体分析器 {
  static readonly type = "星空键道";
  constructor(private config: AnalysisConfig) {}

  分析(复合体映射: Map<string, Compound>, 部件分析: 部件分析结果) {
    type 分析 = 部件分析 | 星空键道复合体分析;
    const 复合体分析: Map<string, 分析> = new Map();
    for (const [字, 字形] of 复合体映射) {
      const 部分结果: 分析[] = [];
      for (const 部分 of 字形.operandList) {
        const result = 部件分析.get(部分) || 复合体分析.get(部分);
        if (result === undefined) return new Error();
        部分结果.push(result);
      }
      if (this.config.roots.has(字)) {
        复合体分析.set(字, {
          字根序列: [字],
          首部字根序列: [],
          余部字根序列: [],
        });
        continue;
      }
      const get = (x: 分析) => x.字根序列;
      const 字根序列 = 按笔顺组装(部分结果.map(get), 字形, 部件分析);
      const 首部字根序列: string[] = [];
      const 余部字根序列: string[] = [];
      if (字形.order?.[0]?.index === 1) {
        // 第一个书写的部分只写了一笔，视同独体字取码
      } else {
        const 排序部分结果 = 按首笔排序(部分结果, 字形);
        for (const [index, part] of 排序部分结果.entries()) {
          if (index === 0) {
            首部字根序列.push(...part.字根序列);
          } else {
            余部字根序列.push(...part.字根序列);
          }
        }
      }
      复合体分析.set(字, { 字根序列, 首部字根序列, 余部字根序列 });
    }
    return 复合体分析;
  }
}

class 张码复合体分析器 implements 复合体分析器 {
  static readonly type = "张码";
  constructor(private config: AnalysisConfig) {}

  分析(复合体映射: Map<string, Compound>, 部件分析: 部件分析结果) {
    type 分析 = 部件分析 | 分部取码复合体分析;
    const 复合体分析: Map<string, 分部取码复合体分析> = new Map();
    for (const [字, 字形] of 复合体映射) {
      const 部分结果: 分析[] = [];
      for (const 部分 of 字形.operandList) {
        const result = 部件分析.get(部分) || 复合体分析.get(部分);
        if (result === undefined) return new Error();
        部分结果.push(result);
      }
      if (this.config.roots.has(字)) {
        复合体分析.set(字, { 字根序列: [字] });
        continue;
      }
      const get = (x: 分析) =>
        "完整字根序列" in x ? x.完整字根序列 : x.字根序列;
      const 完整字根序列: string[] = [];
      if (
        字形.operator === "⿶" ||
        (字形.operator === "⿺" && 字形.operandList[0] === "\ue09d")
      ) {
        for (const part of 部分结果.reverse()) 完整字根序列.push(...get(part));
      } else {
        for (const part of 部分结果) 完整字根序列.push(...get(part));
      }
      const 归一化部分结果 = this.归一化(部分结果, 字形.operator);
      const 字根序列: string[] = /[⿱⿳]/.test(字形.operator)
        ? this.上下结构取码规则(归一化部分结果)
        : /[⿰⿲]/.test(字形.operator)
          ? this.左右结构取码规则(归一化部分结果)
          : [...完整字根序列];
      复合体分析.set(字, { 字根序列 });
    }
    return 复合体分析;
  }

  归一化(x: 分析[], direction: Operator) {
    if (!(x.length === 2 && /[⿰⿱]/.test(direction))) return x;
    const result: 分析[] = [];
    const regex = direction === "⿰" ? /[⿰⿲]/ : /[⿱⿳]/;
    for (const part of x) {
      if (
        result.length < 2 &&
        "operandResults" in part &&
        regex.test(part.结构符)
      ) {
        result.push(...part.部分结果);
      } else {
        result.push(part);
      }
    }
    return result;
  }

  上下结构取码规则(归一化部分结果: 分析[]) {
    const 字根序列: string[] = [];
    const dieyanIndex = 归一化部分结果.findIndex(
      (x) => "operandResults" in x && /[⿰⿲]/.test(x.结构符),
    );
    const dieyan = 归一化部分结果.at(dieyanIndex)! as CompoundGenuineAnalysis;
    const aboveDieyanSequence: string[] = [];
    switch (dieyanIndex) {
      case -1: // 没有叠眼
        for (const part of 归一化部分结果) 字根序列.push(...part.full);
        break;
      case 0: // 叠眼在开头
        for (const part of dieyan.operandResults)
          字根序列.push(...part.full[0]!);
        if (归一化部分结果.length > 2) {
          字根序列.push(归一化部分结果[1]?.full[0]!);
          字根序列.push(归一化部分结果.at(-1)?.full.at(-1)!);
        } else {
          字根序列.push(...this.首末(归一化部分结果[1]!.full));
        }
        break;
      default: // 叠眼在中间或末尾
        for (let index = 0; index < dieyanIndex; ++index) {
          aboveDieyanSequence.push(...归一化部分结果[index]!.full);
        }
        字根序列.push(...aboveDieyanSequence.slice(0, 2));
        if (dieyanIndex + 1 < 归一化部分结果.length) {
          // 叠眼在中间
          字根序列.push(dieyan.operandResults[0]?.full[0]!);
          if (字根序列.length === 2) {
            字根序列.push(dieyan.operandResults.at(-1)?.full[0]!);
          }
          字根序列.push(归一化部分结果.at(-1)?.full.at(-1)!);
        } else {
          字根序列.push(...dieyan.full);
        }
    }
    return 字根序列;
  }

  左右结构取码规则(归一化部分结果: 分析[]) {
    const 字根序列: string[] = [];
    const left = 归一化部分结果[0]!;
    if ("operandResults" in left && /[⿱⿳]/.test(left.结构符)) {
      // 左部是叠型
      const dieyanIndex = left.部分结果.findIndex(
        (x) => "operandResults" in x && /[⿰⿲]/.test(x.结构符),
      );
      const dieyan = left.部分结果.at(dieyanIndex)! as CompoundGenuineAnalysis;
      if (dieyanIndex !== -1) {
        字根序列.push(left.部分结果[0]?.full[0]!);
        if (dieyanIndex === 0)
          字根序列.push(dieyan.operandResults.at(-1)?.full[0]!);
        else 字根序列.push(dieyan.operandResults[0]?.full[0]!);
        字根序列.push(left.部分结果.at(-1)?.full.at(-1)!);
      }
    }
    if (字根序列.length > 0) {
      // 已经处理完左部，直接取右部末码即可
      字根序列.push(归一化部分结果.at(-1)?.full.at(-1)!);
    } else {
      // 一般情况，左部、中部最多各取首尾两根
      字根序列.push(...getShouMo(left.full));
      if (归一化部分结果.length > 2) {
        字根序列.push(...getShouMo(归一化部分结果[1]!.full));
      }
      // 如果左部和中部已经有 4 根，舍弃一根
      if (字根序列.length === 4) 字根序列.pop();
      for (
        let index = Math.min(2, 归一化部分结果.length - 1);
        index < 归一化部分结果.length;
        ++index
      ) {
        字根序列.push(...归一化部分结果[index]!.full);
      }
    }
    return 字根序列;
  }

  首末(x: string[]) {
    return x.length === 1 ? x : [x[0]!, x.at(-1)!];
  }
}

export {
  默认复合体分析器,
  真码复合体分析器,
  首右复合体分析器,
  二笔复合体分析器,
  星空键道复合体分析器,
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
//         // @ts-ignore
//         sequence.push(...x.full2[0]!);
//       }
//     } else {
//       const part = parts[0]!;
//       if ("operandResults" in part) {
//         for (const x of part.部分结果) {
//           // @ts-ignore
//           sequence.push(...x.full2[0]!);
//         }
//       } else {
//         // @ts-ignore
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
//     // @ts-ignore
//     part.full = [...part.full2];
//   });
//   const full2 = sequentialSerializer(operandResults, glyph, config).full;
//   operandResults.forEach((part, i) => {
//     // @ts-ignore
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
