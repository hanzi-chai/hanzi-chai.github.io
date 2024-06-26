import type { AnalysisConfig } from ".";
import { affineMerge } from ".";
import type { ComponentResults, ComponentAnalysis } from "./component";
import { InvalidGlyphError } from "./component";
import { Config } from "./config";
import type {
  Block,
  Compound,
  Character,
  Repertoire,
  Operator,
  SVGGlyph,
} from "./data";
import { PrimitiveRepertoire } from "./data";

export type CompoundResults = Map<string, CompoundAnalysis>;

type PartitionResult = ComponentAnalysis | CompoundAnalysis;

export type CompoundAnalysis = CompoundBasicAnalysis | CompoundGenuineAnalysis;

/**
 * 复合体通过自动拆分算法导出的拆分结果
 */
interface CompoundGenuineAnalysis {
  sequence: string[];
  detail: {
    operator: Operator;
    partitionResults: PartitionResult[];
  };
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
 * @param compound 复合体
 * @param repertoire 原始字符集
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
 * @param repertoire 字符集
 *
 * @returns 拓扑排序后的复合体
 *
 * @remarks 这个实现目前比较低效，需要改进
 */
const topologicalSort = (repertoire: Repertoire, characters: string[]) => {
  let compounds = new Map<string, Character>();
  for (let i = 0; i !== 10; ++i) {
    const thisLevelCompound = new Map<string, Character>();
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
        thisLevelCompound.set(name, character);
      }
    }
    compounds = new Map([...compounds, ...thisLevelCompound]);
  }
  return compounds;
};

const assembleSequence = (
  partitionResults: PartitionResult[],
  order: Block[],
) => {
  const sequence: string[] = [];
  const subsequences = partitionResults.map((x) => ({
    rest: x.sequence,
    taken: 0,
  }));
  for (const { index, strokes } of order) {
    const data = subsequences[index];
    if (data === undefined) {
      continue;
    }
    if (strokes === 0) {
      sequence.push(...data.rest);
      data.rest = [];
    } else {
      const partitionResult = partitionResults[index]!;
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

/**
 * 对复合体进行拆分
 *
 * @param repertoire 字符集
 * @param config 配置
 * @param componentResults 部件拆分结果
 */
export const disassembleCompounds = (
  repertoire: Repertoire,
  config: AnalysisConfig,
  componentResults: ComponentResults,
  characters: string[],
) => {
  const knownCharacters = new Set(characters);
  const compounds = topologicalSort(repertoire, characters);
  const compoundResults: CompoundResults = new Map();
  const compoundError: string[] = [];
  const getResult = function (s: string): PartitionResult | undefined {
    return componentResults.get(s) || compoundResults.get(s);
  };
  for (const [char, glyph] of compounds.entries()) {
    if (config.primaryRoots.has(char) || config.secondaryRoots.has(char)) {
      // 复合体本身是一个字根
      compoundResults.set(char, { sequence: [char] });
      continue;
    }
    const { operator, operandList, order } = glyph.glyph as Compound;
    const rawPartitionResults = operandList.map(getResult);
    if (rawPartitionResults.every((x) => x !== undefined)) {
      // this is safe!
      const partitionResults = rawPartitionResults as PartitionResult[];
      const sequence =
        order === undefined
          ? partitionResults.map((x) => x.sequence).flat()
          : assembleSequence(partitionResults, order);
      compoundResults.set(char, {
        sequence,
        detail: {
          operator,
          partitionResults,
        },
      });
    } else {
      if (knownCharacters.has(char)) {
        compoundError.push(char);
      }
    }
  }
  return [compoundResults, compoundError] as const;
};
