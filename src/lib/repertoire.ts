import { mergeClassifier } from ".";
import type { ComponentResults, ComponentAnalysis } from "./component";
import { disassembleComponents, recursiveRenderComponent } from "./component";
import type { CompoundResults } from "./compound";
import { disassembleCompounds, recursiveRenderCompound } from "./compound";
import type { Analysis, CustomGlyph, CustomReadings } from "./config";
import { Config } from "./config";
import type {
  Compound,
  Character,
  Repertoire,
  PrimitiveRepertoire,
  SVGGlyph,
  Component,
} from "./data";

export const findGlyphIndex = (
  glyphs: (Component | Compound)[],
  tags: string[],
) => {
  for (const tag of tags) {
    const withTag = glyphs.findIndex((x) => (x.tags ?? []).includes(tag));
    if (withTag !== -1) return withTag;
  }
  return 0;
};

/**
 * 将原始字符集转换为字符集
 * 主要的工作是对每个字符，在数据库中的多个字形中选取一个
 *
 * @param repertoire 原始字符集
 * @param customGlyph 自定义字形
 * @param customReadings 自定义读音
 * @param tags 用户选择的标签
 *
 * 基本逻辑为，对于每个字符，
 * - 如果用户指定了字形，则使用用户指定的字形
 * - 如果用户指定的某个标签匹配上了这个字符的某个字形，则使用这个字形
 * - 如果都没有，就使用默认字形
 */
export const determine = (
  repertoire: PrimitiveRepertoire,
  customGlyph: CustomGlyph = {},
  customReadings: CustomReadings = {},
  tags: string[] = [],
) => {
  const determined: Repertoire = {};
  const glyphCache: Map<string, SVGGlyph> = new Map();
  for (const [name, character] of Object.entries(repertoire)) {
    const { ambiguous, glyphs, readings, ...rest } = character;
    const selectedIndex = findGlyphIndex(glyphs, tags);
    const rawglyph = customGlyph[name] ?? glyphs[selectedIndex];
    let finalGlyph: Character["glyph"];
    const finalReadings = customReadings[name] ?? readings;
    if (rawglyph?.type === "derived_component") {
      const svgglyph = recursiveRenderComponent(
        rawglyph,
        repertoire,
        glyphCache,
      );
      if (svgglyph instanceof Error) {
        continue;
      }
      finalGlyph = {
        type: "basic_component",
        tags: rawglyph.tags,
        strokes: svgglyph,
      };
    } else {
      finalGlyph = rawglyph;
    }
    const determined_character: Character = {
      ...rest,
      glyph: finalGlyph,
      readings: finalReadings,
    };
    determined[name] = determined_character;
  }
  return determined;
};

export interface AnalysisResult {
  componentResults: ComponentResults;
  componentError: string[];
  customizations: ComponentResults;
  customized: ComponentResults;
  compoundResults: CompoundResults;
  compoundError: string[];
  rootSequence: Map<string, number[]>;
}

export interface AnalysisConfig {
  analysis: Analysis;
  primaryRoots: Set<string>;
  secondaryRoots: Set<string>;
}

const getRootSequence = function (
  repertoire: Repertoire,
  config: AnalysisConfig,
) {
  const classifier = mergeClassifier(config.analysis?.classifier);
  const findSequence = (x: string) => {
    if (x.match(/[0-9]+/)) {
      return [...x].map(Number);
    }
    const glyph = repertoire[x]?.glyph;
    if (glyph === undefined) {
      return [];
    }
    if (glyph.type === "basic_component") {
      return glyph.strokes.map((s) => classifier[s.feature]);
    } else {
      const sequence = recursiveRenderCompound(glyph, repertoire);
      if (sequence instanceof Error) return [];
      return sequence.map((s) => classifier[s.feature]);
    }
  };
  const rootSequence = new Map<string, number[]>();
  const roots = new Set([...config.primaryRoots, ...config.secondaryRoots]);
  for (const root of roots) {
    rootSequence.set(root, findSequence(root));
  }
  for (const num of Object.values(classifier)) {
    rootSequence.set(num.toString(), [num]);
  }
  return rootSequence;
};

/**
 * 对整个字符集中的字符进行拆分
 *
 * @param repertoire 字符集
 * @param config 配置
 */
export const analysis = function (
  repertoire: Repertoire,
  config: AnalysisConfig,
  characters: string[],
): AnalysisResult {
  const [componentResults, componentError] = disassembleComponents(
    repertoire,
    config,
    characters,
  );
  const customizations: ComponentResults = new Map(
    Object.entries(config.analysis?.customize ?? {}).map(
      ([component, sequence]) => {
        const pseudoResult: ComponentAnalysis = {
          strokes: 0,
          sequence: sequence,
        };
        return [component, pseudoResult] as const;
      },
    ),
  );
  const customized = new Map([...componentResults, ...customizations]);
  const [compoundResults, compoundError] = disassembleCompounds(
    repertoire,
    config,
    customized,
    characters,
  );
  const rootSequence = getRootSequence(repertoire, config);
  return {
    componentResults,
    componentError,
    customizations,
    customized,
    compoundResults,
    compoundError,
    rootSequence,
  };
};
