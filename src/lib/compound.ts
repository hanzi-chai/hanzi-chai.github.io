import type { AnalysisConfig } from "./repertoire";
import { affineMerge } from "./affine";
import type { ComponentResults, ComponentAnalysis } from "./component";
import { InvalidGlyphError } from "./component";
import type {
  Compound,
  Repertoire,
  Operator,
  SVGGlyph,
  CompoundCharacter,
} from "./data";

export type CompoundResults = Map<string, CompoundAnalysis>;

type PartitionResult = ComponentAnalysis | CompoundAnalysis;

export type CompoundAnalysis = CompoundBasicAnalysis | CompoundGenuineAnalysis;

/**
 * 复合体通过自动拆分算法导出的拆分结果
 */
interface CompoundGenuineAnalysis {
  sequence: string[];
  operator: Operator;
  operandResults: PartitionResult[];
}

/**
 * 复合体本身是字根字，没有拆分细节
 */
interface CompoundBasicAnalysis {
  sequence: [string];
}

/**
 * 将复合体递归渲染为 SVG 图形
 *
 * @param compound - 复合体
 * @param repertoire - 原始字符集
 *
 * @returns SVG 图形
 * @throws InvalidGlyphError 无法渲染
 */
export const recursiveRenderCompound = function (
  compound: Compound,
  repertoire: Repertoire,
  glyphCache: Map<string, SVGGlyph> = new Map(),
): SVGGlyph | InvalidGlyphError {
  const glyphs: SVGGlyph[] = [];
  for (const char of compound.operandList) {
    const glyph = repertoire[char]?.glyph;
    if (glyph === undefined) return new InvalidGlyphError();
    if (glyph.type === "basic_component") {
      glyphs.push(glyph.strokes);
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
 * 对字符集进行拓扑排序，得到复合体的拆分顺序
 *
 * @param repertoire - 字符集
 *
 * @returns 拓扑排序后的复合体
 *
 * @remarks 这个实现目前比较低效，需要改进
 */
const topologicalSort = (repertoire: Repertoire) => {
  let compounds = new Map<string, CompoundCharacter>();
  for (let i = 0; i !== 10; ++i) {
    const thisLevelCompound = new Map<string, CompoundCharacter>();
    for (const [name, character] of Object.entries(repertoire)) {
      const { glyph } = character;
      if (compounds.get(name)) continue;
      if (glyph === undefined || glyph.type !== "compound") continue;
      if (
        glyph.operandList.every(
          (x) =>
            repertoire[x]?.glyph?.type === "basic_component" ||
            compounds.get(x) !== undefined,
        )
      ) {
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
  name?: string,
) => string[];

const sequentialSerializer: Serializer = (operandResults, glyph) => {
  if (glyph.order === undefined)
    return operandResults.map((x) => x.sequence).flat();
  const sequence: string[] = [];
  const subsequences = operandResults.map((x) => ({
    rest: x.sequence,
    taken: 0,
  }));
  for (const { index, strokes } of glyph.order) {
    const data = subsequences[index];
    if (data === undefined) {
      continue;
    }
    if (strokes === 0) {
      sequence.push(...data.rest);
      data.rest = [];
    } else {
      const partitionResult = operandResults[index]!;
      if ("schemes" in partitionResult) {
        const { detail, strokes: totalStrokes } = partitionResult;
        const upperBound = 1 << (totalStrokes - data.taken);
        const lowerBound = 1 << (totalStrokes - data.taken - strokes);
        const toTake = detail.filter(
          ({ binary }) => binary >= lowerBound && binary < upperBound,
        ).length;
        sequence.push(...data.rest.slice(0, toTake));
        data.rest = data.rest.slice(toTake);
      } else {
        sequence.push(...data.rest);
        data.rest = [];
      }
    }
  }
  return sequence;
};

const recursiveExpand: (x: PartitionResult[]) => PartitionResult[] = (x) => {
  const result: PartitionResult[] = [];
  for (const part of x) {
    if ("operandResults" in part && /[⿱⿳]/.test(part.operator)) {
      result.push(...recursiveExpand(part.operandResults));
    } else {
      result.push(part);
    }
  }
  return result;
};

const robustPartition = (p: {
  operandResults: PartitionResult[];
  operator: Operator;
}) => {
  const { operandResults, operator } = p;
  const firstPartition: PartitionResult[] = [];
  let start = 0;
  let dieyanAfter;
  // 叠和非叠
  const die = /[⿱⿳]/;
  const notDie = /[^⿱⿳]/;
  // 叠眼
  let dieyan: boolean[];
  const postProcess: (x: PartitionResult[]) => PartitionResult = (x) => {
    if (x.length === 2) {
      return {
        sequence: x.map((y) => y.sequence).flat(),
        operator: "⿱",
        operandResults: x,
      };
    } else if (x.length === 3) {
      return {
        sequence: x.map((y) => y.sequence[0]!),
        operator: "⿳",
        operandResults: x,
      };
    }
    return x[0]!;
  };
  if (die.test(operator)) {
    const expanded = recursiveExpand(operandResults);
    dieyan = expanded.map((x) => "operator" in x && notDie.test(x.operator));
    for (const [i, x] of dieyan.entries()) {
      if (x) {
        const dieyanBefore = expanded.slice(start, i);
        if (dieyanBefore.length > 0) {
          firstPartition.push(postProcess(dieyanBefore));
        }
        firstPartition.push(expanded[i]!);
        start = i + 1;
      }
    }
    dieyanAfter = expanded.slice(start);
    if (dieyanAfter.length > 0) {
      firstPartition.push(postProcess(dieyanAfter));
    }
  } else {
    firstPartition.push(...operandResults);
  }
  return firstPartition;
};

const c3Serializer: Serializer = (operandResults, glyph) => {
  const primaryPartition = robustPartition({
    operandResults,
    operator: glyph.operator,
  });
  if (primaryPartition.length === 1) {
    return primaryPartition[0]!.sequence.slice(0, 3);
  } else if (primaryPartition.length === 3) {
    return primaryPartition.map((x) => x.sequence[0]!);
  } else {
    // 需要执行二次拆分
    const sequence: string[] = [];
    for (const part of primaryPartition) {
      if ("operandResults" in part) {
        const smallerParts = robustPartition(part).slice(0, 2);
        if (smallerParts.length >= 2) {
          sequence.push(...smallerParts.map((x) => x.sequence[0]!));
        } else {
          sequence.push(...smallerParts[0]!.sequence.slice(0, 2));
        }
      } else {
        sequence.push(...part.sequence.slice(0, 2));
      }
    }
    return sequence.slice(0, 3);
  }
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
) => {
  const knownCharacters = new Set(characters);
  const compounds = topologicalSort(repertoire);
  const compoundResults: CompoundResults = new Map();
  const compoundError: string[] = [];
  const getResult = function (s: string): PartitionResult | undefined {
    return componentResults.get(s) || compoundResults.get(s);
  };
  const serializerName = config.analysis.serializer ?? "sequential";
  const serializer =
    serializerName === "c3" ? c3Serializer : sequentialSerializer;
  for (const [char, { glyph }] of compounds.entries()) {
    if (config.primaryRoots.has(char) || config.secondaryRoots.has(char)) {
      // 复合体本身是一个字根
      compoundResults.set(char, { sequence: [char] });
      continue;
    }
    const { operator, operandList } = glyph;
    const rawOperandResults = operandList.map(getResult);
    if (rawOperandResults.every((x) => x !== undefined)) {
      // this is safe!
      const operandResults = rawOperandResults as PartitionResult[];
      const sequence = serializer(operandResults, glyph, char);
      compoundResults.set(char, {
        sequence,
        operator,
        operandResults: operandResults,
      });
    } else {
      if (knownCharacters.has(char)) {
        compoundError.push(char);
      }
    }
  }
  return [compoundResults, compoundError] as const;
};
