import type { AnalysisConfig } from "./repertoire";
import { affineMerge } from "./affine";
import type {
  ComponentResults,
  ComponentAnalysis,
  CommonAnalysis,
} from "./component";
import { InvalidGlyphError } from "./component";
import type {
  Compound,
  Repertoire,
  Operator,
  SVGGlyph,
  CompoundCharacter,
  SVGGlyphWithBox,
} from "./data";
import { first, range, sortBy } from "lodash-es";
import type { BoundingBox } from "./bezier";
import { classifier } from "./classifier";

export type CompoundResults = Map<string, CompoundAnalysis | ComponentAnalysis>;

type PartitionResult = ComponentAnalysis | CompoundAnalysis;

export type CompoundAnalysis = CompoundBasicAnalysis | CompoundGenuineAnalysis;

/**
 * 复合体本身是字根字，没有拆分细节
 */
interface CompoundBasicAnalysis extends CommonAnalysis {
  operator: Operator;
}

/**
 * 复合体通过自动拆分算法导出的拆分结果
 */
interface CompoundGenuineAnalysis extends CompoundBasicAnalysis {
  operandResults: PartitionResult[];
}

export const getGlyphBoundingBox = (glyph: SVGGlyph) => {
  let [xmin, ymin, xmax, ymax] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const { start, curveList } of glyph) {
    let [x, y] = start;
    xmin = Math.min(xmin, x);
    ymin = Math.min(ymin, y);
    xmax = Math.max(xmax, x);
    ymax = Math.max(ymax, y);
    for (const { command, parameterList } of curveList) {
      switch (command) {
        case "h":
          x += parameterList[0];
          break;
        case "v":
          y += parameterList[0];
          break;
        case "a":
          xmin = Math.min(xmin, x - parameterList[0]);
          xmax = Math.max(xmax, x + parameterList[0]);
          ymax = Math.max(ymax, y + 2 * parameterList[0]);
          break;
        default: {
          const [_x1, _y1, _x2, _y2, x3, y3] = parameterList;
          x += x3;
          y += y3;
          break;
        }
      }
      xmin = Math.min(xmin, x);
      ymin = Math.min(ymin, y);
      xmax = Math.max(xmax, x);
      ymax = Math.max(ymax, y);
    }
  }
  const bb: BoundingBox = { x: [xmin, xmax], y: [ymin, ymax] };
  return bb;
};

/**
 * 将复合体递归渲染为 SVG 图形
 *
 * @param compound - 复合体
 * @param repertoire - 原始字符集
 *
 * @returns SVG 图形
 * @throws InvalidGlyphError 无法渲染
 */
export const recursiveRenderCompound = (
  compound: Compound,
  repertoire: Repertoire,
  glyphCache: Map<string, SVGGlyphWithBox> = new Map(),
): SVGGlyphWithBox | InvalidGlyphError => {
  const glyphs: SVGGlyphWithBox[] = [];
  for (const char of compound.operandList) {
    const glyph = repertoire[char]?.glyph;
    if (glyph === undefined) return new InvalidGlyphError();
    if (glyph.type === "basic_component") {
      let box = glyphCache.get(char)?.box;
      if (box === undefined) {
        box = getGlyphBoundingBox(glyph.strokes);
        glyphCache.set(char, { strokes: glyph.strokes, box: box });
      }
      glyphs.push({ strokes: glyph.strokes, box });
    } else {
      const cache = glyphCache.get(char);
      if (cache !== undefined) {
        glyphs.push(cache);
        continue;
      }
      const rendered = recursiveRenderCompound(glyph, repertoire, glyphCache);
      if (rendered instanceof Error) return rendered;
      glyphs.push(rendered);
      glyphCache.set(char, rendered);
    }
  }
  return affineMerge(compound, glyphs);
};

/**
 * 将复合体递归渲染为 SVG 图形
 *
 * @param compound - 复合体
 * @param repertoire - 原始字符集
 *
 * @returns SVG 图形
 * @throws InvalidGlyphError 无法渲染
 */
export const recursiveRenderStrokeSequence = (
  compound: Compound,
  repertoire: Repertoire,
  sequenceCache: Map<string, string> = new Map(),
): string | InvalidGlyphError => {
  const sequences: string[] = [];
  for (const char of compound.operandList) {
    const glyph = repertoire[char]?.glyph;
    if (glyph === undefined) return new InvalidGlyphError();
    if (glyph.type === "basic_component") {
      sequences.push(glyph.strokes.map((x) => classifier[x.feature]).join(""));
    } else {
      const cache = sequenceCache.get(char);
      if (cache !== undefined) {
        sequences.push(cache);
        continue;
      }
      const rendered = recursiveRenderStrokeSequence(
        glyph,
        repertoire,
        sequenceCache,
      );
      if (rendered instanceof Error) return rendered;
      sequences.push(rendered);
      sequenceCache.set(char, rendered);
    }
  }
  const { order } = compound;
  if (order === undefined) {
    return sequences.join("");
  } else {
    const merged: string[] = [];
    for (const { index, strokes } of order) {
      const seq = sequences[index];
      if (seq === undefined) continue;
      if (strokes === 0) {
        merged.push(seq);
      } else {
        merged.push(seq.slice(0, strokes));
        sequences[index] = seq.slice(strokes);
      }
    }
    return merged.join("");
  }
};

/**
 * 对字符集进行拓扑排序，得到复合体的拆分顺序
 *
 * @param repertoire - 字符集
 *
 * @returns 拓扑排序后的复合体
 *
 * @remarks 这个实现目前比较低效，需要改进
 */
export const topologicalSort = (
  repertoire: Repertoire,
  required: Set<string>,
  config: AnalysisConfig,
) => {
  let compounds = new Map<string, CompoundCharacter>();
  for (let i = 0; i !== 10; ++i) {
    const thisLevelCompound = new Map<string, CompoundCharacter>();
    for (const [name, character] of Object.entries(repertoire)) {
      if (!required.has(name) || compounds.get(name)) continue;
      const { glyph } = character;
      if (glyph === undefined || glyph.type !== "compound") continue;
      const wellKnown = glyph.operandList.every(
        (x) =>
          repertoire[x]?.glyph?.type === "basic_component" ||
          compounds.get(x) !== undefined,
      );
      const isRoot = config.roots.has(name) && !config.optionalRoots.has(name);
      if (wellKnown || isRoot) {
        thisLevelCompound.set(name, character as CompoundCharacter);
      }
    }
    compounds = new Map([...compounds, ...thisLevelCompound]);
  }
  return compounds;
};

type Serializer = (
  r: PartitionResult[],
  g: Compound,
  c: AnalysisConfig,
) => CompoundAnalysis;

const sequentialSerializer: Serializer = (operandResults, glyph) => {
  const rest = {
    operator: glyph.operator,
    operandResults,
  };
  if (glyph.order === undefined) {
    const full = operandResults.flatMap((x) => x.full);
    return { sequence: [...full], full, ...rest };
  }
  const full: string[] = [];
  const subsequences = operandResults.map((x) => ({
    rest: x.full,
    taken: 0,
  }));
  for (const { index, strokes } of glyph.order) {
    const data = subsequences[index];
    if (data === undefined) {
      continue;
    }
    if (strokes === 0) {
      full.push(...data.rest);
      data.rest = [];
    } else {
      const partitionResult = operandResults[index]!;
      if ("schemes" in partitionResult) {
        const { best, strokes: totalStrokes } = partitionResult;
        const upperBound = 1 << (totalStrokes - data.taken);
        const lowerBound = 1 << (totalStrokes - data.taken - strokes);
        const toTake = best.scheme.filter(
          (binary) => binary >= lowerBound && binary < upperBound,
        ).length;
        full.push(...data.rest.slice(0, toTake));
        data.rest = data.rest.slice(toTake);
      } else {
        full.push(...data.rest);
        data.rest = [];
      }
    }
  }
  return { sequence: [...full], full, ...rest };
};

const zhenmaSerializer: Serializer = (operandResults, glyph) => {
  const sequence: string[] = [];
  if (glyph.operator === "⿶") {
    sequence.push(...operandResults[1]!.sequence);
    sequence.push(...operandResults[0]!.sequence);
  } else {
    operandResults.map((x) => x.sequence).forEach((x) => sequence.push(...x));
  }
  return {
    sequence,
    full: [],
    operator: glyph.operator,
    operandResults,
  };
};

const regularize = (x: PartitionResult[], direction: Operator) => {
  const result: PartitionResult[] = [];
  const regex = direction === "⿰" ? /[⿰⿲]/ : /[⿱⿳]/;
  for (const part of x) {
    if (
      result.length < 2 &&
      "operandResults" in part &&
      regex.test(part.operator)
    ) {
      result.push(...part.operandResults);
    } else {
      result.push(part);
    }
  }
  return result;
};

// eslint-disable-next-line complexity
const zhangmaSerializer: Serializer = (operandResults, glyph) => {
  const sequence: string[] = [];
  const full: string[] = [];
  if (
    glyph.operator === "⿶" ||
    (glyph.operator === "⿺" && glyph.operandList[0] === "\ue09d")
  ) {
    for (const part of operandResults.reverse()) full.push(...part.full);
  } else {
    for (const part of operandResults) full.push(...part.full);
  }
  const getShouMo = (x: string[]) => (x.length === 1 ? x : [x[0]!, x.at(-1)!]);
  const regularizedResults =
    operandResults.length === 2 && /[⿰⿱]/.test(glyph.operator)
      ? regularize(operandResults, glyph.operator)
      : operandResults;
  if (/[⿱⿳]/.test(glyph.operator)) {
    const dieyanIndex = regularizedResults.findIndex(
      (x) => "operandResults" in x && /[⿰⿲]/.test(x.operator),
    );
    const dieyan = regularizedResults.at(
      dieyanIndex,
    )! as CompoundGenuineAnalysis;
    const aboveDieyanSequence: string[] = [];
    switch (dieyanIndex) {
      case -1: // 没有叠眼
        for (const part of regularizedResults) sequence.push(...part.full);
        break;
      case 0: // 叠眼在开头
        for (const part of dieyan.operandResults)
          sequence.push(...part.full[0]!);
        if (regularizedResults.length > 2) {
          sequence.push(regularizedResults[1]?.full[0]!);
          sequence.push(regularizedResults.at(-1)?.full.at(-1)!);
        } else {
          sequence.push(...getShouMo(regularizedResults[1]!.full));
        }
        break;
      default: // 叠眼在中间或末尾
        for (let index = 0; index < dieyanIndex; ++index) {
          aboveDieyanSequence.push(...regularizedResults[index]!.full);
        }
        sequence.push(...aboveDieyanSequence.slice(0, 2));
        if (dieyanIndex + 1 < regularizedResults.length) {
          // 叠眼在中间
          sequence.push(dieyan.operandResults[0]?.full[0]!);
          if (sequence.length === 2) {
            sequence.push(dieyan.operandResults.at(-1)?.full[0]!);
          }
          sequence.push(regularizedResults.at(-1)?.full.at(-1)!);
        } else {
          sequence.push(...dieyan.full);
        }
    }
  } else if (/[⿰⿲]/.test(glyph.operator)) {
    const left = regularizedResults[0]!;
    if ("operandResults" in left && /[⿱⿳]/.test(left.operator)) {
      // 左部是叠型
      const dieyanIndex = left.operandResults.findIndex(
        (x) => "operandResults" in x && /[⿰⿲]/.test(x.operator),
      );
      const dieyan = left.operandResults.at(
        dieyanIndex,
      )! as CompoundGenuineAnalysis;
      if (dieyanIndex !== -1) {
        sequence.push(left.operandResults[0]?.full[0]!);
        if (dieyanIndex === 0)
          sequence.push(dieyan.operandResults.at(-1)?.full[0]!);
        else sequence.push(dieyan.operandResults[0]?.full[0]!);
        sequence.push(left.operandResults.at(-1)?.full.at(-1)!);
      }
    }
    if (sequence.length > 0) {
      // 已经处理完左部，直接取右部末码即可
      sequence.push(regularizedResults.at(-1)?.full.at(-1)!);
    } else {
      // 一般情况，左部、中部最多各取首尾两根
      sequence.push(...getShouMo(left.full));
      if (regularizedResults.length > 2) {
        sequence.push(...getShouMo(regularizedResults[1]!.full));
      }
      // 如果左部和中部已经有 4 根，舍弃一根
      if (sequence.length === 4) sequence.pop();
      for (
        let index = Math.min(2, regularizedResults.length - 1);
        index < regularizedResults.length;
        ++index
      ) {
        sequence.push(...regularizedResults[index]!.full);
      }
    }
  } else {
    // 围型：先分解围框，再分解围芯
    sequence.push(...full);
  }
  // 不考虑四角
  return {
    sequence,
    full,
    operator: glyph.operator,
    operandResults: regularizedResults,
  };
};

const snow2Serializer: Serializer = (operandResults, glyph) => {
  const order =
    glyph.order ?? glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
  const sortedOperandResults = sortBy(range(operandResults.length), (i) =>
    order.findIndex((b) => b.index === i),
  ).map((i) => operandResults[i]!);
  const first = sortedOperandResults[0]!;
  const second = sortedOperandResults[1]!;
  const sequence = [
    first.sequence[0]!,
    second.sequence[0]!,
    first.sequence.length > 1 ? "w" : "q",
  ];
  return {
    sequence,
    full: [],
    operator: glyph.operator,
    operandResults,
  };
};

const limit = (sequence: string[], maximum: number, config: AnalysisConfig) => {
  let codes = 0; // 记录整体的取码数
  const { roots } = config;
  const final: string[] = [];
  for (const x of sequence) {
    if (x === "·") {
      final.push(x);
      continue;
    }
    // FIXME: 这里的规则需要根据实际情况调整
    const length = 1;
    codes += length;
    final.push(x);
    if (codes >= maximum) break;
  }
  return final;
};

const xkjdSerializer: Serializer = (operandResults, glyph, config) => {
  const { roots: primaryRoots } = config;
  const order =
    glyph.order ?? glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
  const sequence: string[] = [];
  const full: string[] = [];
  const sequential = sequentialSerializer(operandResults, glyph, config);
  full.push(...sequential.full);
  if (order[0]?.strokes !== 1) {
    // 第一个书写的部分并不是只写了一笔，此时不考虑笔顺交错，依次取各个部分
    const sortedOperandResults = sortBy(range(operandResults.length), (i) =>
      order.findIndex((b) => b.index === i),
    ).map((i) => operandResults[i]!);
    for (const [index, part] of sortedOperandResults.entries()) {
      if (index === 0) {
        let codes = 0; // 记录部分的取码数
        for (const x of part.full) {
          // FIXME: 这里的规则需要根据实际情况调整
          const length = 1;
          if (codes === 1 && length > 1) {
            const equivalent: Record<string, string> = {
              土: "1",
              艹: "2",
              金: "2",
              手: "2",
              十: "3",
              日: "4",
              贝: "5",
            };
            sequence.push(equivalent[x] ?? "1");
          } else {
            sequence.push(x);
          }
          codes += length;
          if (codes >= 2) break;
        }
        // sequence.push("·"); // 二分标记
      } else {
        sequence.push(...part.full);
      }
    }
  } else {
    // 第一个书写的部分只写了一笔，此时考虑笔顺交错
    sequence.push(...sequential.sequence);
  }
  const finalSequence = limit(sequence, 4, config);
  return {
    sequence: finalSequence,
    full,
    operator: glyph.operator,
    operandResults,
  };
};

const shouyouSerializer: Serializer = (operandResults, glyph, config) => {
  const order =
    glyph.order ?? glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
  const sortedOperandResults = sortBy(range(operandResults.length), (i) =>
    order.findIndex((b) => b.index === i),
  ).map((i) => operandResults[i]!);
  const first = sortedOperandResults[0]!;
  const second = sortedOperandResults[1]!;
  let sequence;
  const full = sequentialSerializer(operandResults, glyph, config).full;
  if (
    /[⿰⿲]/.test(glyph.operator) ||
    (glyph.operator === "⿺" && order[0]!.index === 0)
  )
    sequence = [first.full[0]!, second.full[0]!];
  else {
    sequence = [...full];
  }
  return {
    sequence,
    full,
    operator: glyph.operator,
    operandResults,
  };
};

const feihuaSerializer: Serializer = (operandResults, glyph, config) => {
  const order =
    glyph.order ?? glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
  const sortedOperandResults = sortBy(range(operandResults.length), (i) =>
    order.findIndex((b) => b.index === i),
  ).map((i) => operandResults[i]!);
  const sequence: string[] = [];
  const full = sequentialSerializer(operandResults, glyph, config).full;
  const first = sortedOperandResults[0]!;
  const last = sortedOperandResults.at(-1)!;
  if (first.full.length !== 1 && last.full.length === 1) {
    sequence.push(...last.full);
    if (last.full.length === 1 && last.full[0] === "阝") {
      sequence[0] = "邑";
    }
    for (const x of sortedOperandResults.slice(0, -1)) {
      sequence.push(...x.full);
    }
  } else {
    for (const x of sortedOperandResults) {
      sequence.push(...x.full);
    }
  }
  return {
    sequence,
    full,
    operator: glyph.operator,
    operandResults,
  };
};

const erbiSerializer: Serializer = (operandResults, glyph, config) => {
  const order =
    glyph.order ?? glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
  const sortedOperandResults = sortBy(range(operandResults.length), (i) =>
    order.findIndex((b) => b.index === i),
  ).map((i) => operandResults[i]!);
  const sequence: string[] = [];
  for (const [index, part] of sortedOperandResults.entries()) {
    if (index === sortedOperandResults.length - 1)
      sequence.push(...part.sequence);
    else sequence.push(part.sequence[0]!);
  }
  return {
    sequence: sequence,
    full: sequence,
    operator: glyph.operator,
    operandResults,
  };
};

export const serializerTypes = [
  "sequential",
  "zhangma",
  "zhenma",
  "snow2",
  "xkjd",
  "shouyou",
  "feihua",
  "erbi",
] as const;
export type SerializerType = (typeof serializerTypes)[number];

export const serializerMap: Record<SerializerType, Serializer> = {
  sequential: sequentialSerializer,
  zhangma: zhangmaSerializer,
  zhenma: zhenmaSerializer,
  snow2: snow2Serializer,
  xkjd: xkjdSerializer,
  shouyou: shouyouSerializer,
  feihua: feihuaSerializer,
  erbi: erbiSerializer,
};

/**
 * 对复合体进行拆分
 *
 * @param repertoire - 字符集
 * @param config - 配置
 * @param componentResults - 部件拆分结果
 */
export const disassembleCompounds = (
  repertoire: Repertoire,
  config: AnalysisConfig,
  componentResults: ComponentResults,
  characters: string[],
  requiredCompounds: Set<string>,
) => {
  const knownCharacters = new Set(characters);
  const compounds = topologicalSort(repertoire, requiredCompounds, config);
  const compoundResults: CompoundResults = new Map();
  const compoundError: string[] = [];
  const getResult = (s: string): PartitionResult | undefined =>
    componentResults.get(s) || compoundResults.get(s);
  const serializerName = config.analysis.serializer ?? "sequential";
  const serializer = serializerMap[serializerName] ?? sequentialSerializer;
  if (serializerName === "xkjd") {
    for (const [_, result] of componentResults.entries()) {
      result.sequence = limit(result.sequence, 4, config);
    }
  } else if (serializerName === "snow2") {
    for (const [key, result] of componentResults.entries()) {
      result.sequence = result.sequence.slice(0, 1);
      if (result.sequence[0] !== key) result.sequence.push("");
    }
  }
  for (const [char, { glyph }] of compounds.entries()) {
    if (config.roots.has(char)) {
      // 复合体本身是一个字根
      compoundResults.set(char, {
        sequence: [char],
        full: [char],
        strokes: 0,
        operator: undefined,
      });
      continue;
    }
    const rawOperandResults = glyph.operandList.map(getResult);
    if (rawOperandResults.every((x) => x !== undefined)) {
      // this is safe!
      const operandResults = rawOperandResults as PartitionResult[];
      const serialization = serializer(operandResults, glyph, config);
      compoundResults.set(char, serialization);
    } else {
      if (knownCharacters.has(char)) {
        compoundError.push(char);
      }
    }
  }
  return [compoundResults, compoundError] as const;
};
