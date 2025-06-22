import { isEqual } from "lodash-es";
import { mergeClassifier } from "./classifier";
import type {
  ComponentResults,
  ComponentBasicAnalysis,
  ComponentGenuineAnalysis,
} from "./component";
import { disassembleComponents, recursiveRenderComponent } from "./component";
import type { CompoundResults } from "./compound";
import { disassembleCompounds, recursiveRenderCompound } from "./compound";
import type {
  Analysis,
  CustomGlyph,
  CustomReadings,
  Element,
  Mapped,
} from "./config";
import type {
  Compound,
  Character,
  Repertoire,
  PrimitiveRepertoire,
  SVGGlyph,
  Component,
  Glyph,
  BasicComponent,
} from "./data";

export const findGlyphIndex = (glyphs: Glyph[], tags: string[]) => {
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
 * @param repertoire - 原始字符集
 * @param customGlyph - 自定义字形
 * @param customReadings - 自定义读音
 * @param tags - 用户选择的标签
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
    const { ambiguous: _, glyphs, readings, ...rest } = character;
    const selectedIndex = findGlyphIndex(glyphs, tags);
    const rawglyph = customGlyph[name]! ?? glyphs[selectedIndex]!;
    const glyph = recursiveHandleRawGlyph(rawglyph, glyphCache, repertoire);
    const finalReadings = customReadings[name] ?? readings;
    const determined_character: Character = {
      ...rest,
      glyph,
      readings: finalReadings,
    };
    determined[name] = determined_character;
  }
  return determined;
};

function recursiveHandleRawGlyph(
  glyph: Glyph,
  glyphCache: Map<string, SVGGlyph>,
  repertoire: PrimitiveRepertoire,
): BasicComponent | Compound {
  if (
    glyph.type === "derived_component" ||
    glyph.type === "spliced_component"
  ) {
    const svgglyph = recursiveRenderComponent(glyph, repertoire, glyphCache);
    return {
      type: "basic_component",
      tags: glyph.tags,
      strokes: svgglyph instanceof Error ? [] : svgglyph,
    };
  } else if (glyph.type === "identity") {
    return recursiveHandleRawGlyph(
      repertoire[glyph.source]!.glyphs[0]!,
      glyphCache,
      repertoire,
    );
  } else {
    return glyph;
  }
}

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
  primaryRoots: Map<Element, Mapped>;
  secondaryRoots: Map<Element, Element>;
}

const getRootSequence = (repertoire: Repertoire, config: AnalysisConfig) => {
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
    }
    const sequence = recursiveRenderCompound(glyph, repertoire);
    if (sequence instanceof Error) return [];
    return sequence.strokes.map((s) => classifier[s.feature]);
  };
  const rootSequence = new Map<string, number[]>();
  const roots = new Set([
    ...config.primaryRoots.keys(),
    ...config.secondaryRoots.keys(),
  ]);
  for (const root of roots) {
    rootSequence.set(root, findSequence(root));
  }
  for (const num of Object.values(classifier)) {
    rootSequence.set(num.toString(), [num]);
  }
  return rootSequence;
};

/**
 * 确定需要分析的字符
 */
export const getRequiredTargets = (
  repertoire: Repertoire,
  config: AnalysisConfig,
  characters: string[],
) => {
  const queue = [...characters];
  const components = new Set<string>();
  const compounds = new Set<string>();
  const knownSet = new Set<string>(characters);
  while (queue.length) {
    const char = queue.shift()!;
    const glyph = repertoire[char]?.glyph!;
    if (glyph.type === "compound") {
      compounds.add(char);
      if (config.primaryRoots.has(char) || config.secondaryRoots.has(char))
        continue;
      glyph.operandList.forEach((x) => {
        if (!knownSet.has(x)) {
          knownSet.add(x);
          queue.push(x);
        }
      });
    } else {
      components.add(char);
    }
  }
  return { components, compounds };
};

/**
 * 对整个字符集中的字符进行拆分
 *
 * @param repertoire - 字符集
 * @param config - 配置
 */
export const analysis = (
  repertoire: Repertoire,
  config: AnalysisConfig,
  characters: string[],
): AnalysisResult => {
  const { components, compounds } = getRequiredTargets(
    repertoire,
    config,
    characters,
  );
  const [componentResults, componentError] = disassembleComponents(
    repertoire,
    config,
    characters,
    components,
  );
  const customizations: ComponentResults = new Map();
  const customConfig = config.analysis?.customize ?? {};
  for (const [component, sequence] of Object.entries(customConfig)) {
    const previousResult = componentResults.get(component);
    if (previousResult !== undefined && "best" in previousResult) {
      const maybeBetter = previousResult.schemes.find((x) => {
        const list = x.scheme.map((y) => previousResult.map.get(y)!);
        return isEqual(list, sequence);
      });
      if (maybeBetter !== undefined) {
        const genuineResult: ComponentGenuineAnalysis = {
          ...previousResult,
          best: maybeBetter,
          sequence: sequence,
          full: sequence,
        };
        customizations.set(component, genuineResult);
        continue;
      }
    }
    const pseudoResult: ComponentBasicAnalysis = {
      strokes: 0,
      sequence: sequence,
      full: sequence,
      operator: undefined,
      corners: [0, 0, 0, sequence.length - 1],
    };
    customizations.set(component, pseudoResult);
  }
  const customized = new Map([...componentResults, ...customizations]);
  const [compoundResults, compoundError] = disassembleCompounds(
    repertoire,
    config,
    customized,
    characters,
    compounds,
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
