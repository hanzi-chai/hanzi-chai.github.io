import { isEqual, sortBy } from "lodash-es";
import { mergeClassifier } from "./classifier";
import type {
  ComponentResults,
  ComponentBasicAnalysis,
  ComponentGenuineAnalysis,
} from "./component";
import { disassembleComponents, recursiveRenderComponent } from "./component";
import type { CompoundResults } from "./compound";
import {
  disassembleCompounds,
  recursiveRenderCompound,
  topologicalSort,
} from "./compound";
import type {
  Algebra,
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
import { range } from "d3-array";
import { applyRules } from "./element";

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
  optionalRoots: Set<Element>;
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
    ...config.optionalRoots.keys(),
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
      const isCurrentRoot =
        config.primaryRoots.has(char) || config.secondaryRoots.has(char);
      const isOptionalRoot = config.optionalRoots.has(char);
      if (isCurrentRoot && !isOptionalRoot) continue;
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
    };
    customizations.set(component, pseudoResult);
  }
  const all = new Set([
    ...config.primaryRoots.keys(),
    ...config.secondaryRoots.keys(),
  ]);
  for (const [component, sequenceList] of Object.entries(
    config.analysis?.dynamicCustomize ?? {},
  )) {
    let found = false;
    for (const sequence of sequenceList) {
      if (!sequence.every((x) => /\d/.test(x) || all.has(x))) continue;
      const pseudoResult: ComponentBasicAnalysis = {
        strokes: 0,
        sequence: sequence,
        full: sequence,
        operator: undefined,
      };
      found = true;
      customizations.set(component, pseudoResult);
      console.log(
        `Dynamic customization for ${component} found: ${JSON.stringify(
          sequence,
        )}`,
      );
      break;
    }
    if (!found) {
      console.warn(
        `Dynamic customization for ${component} not found in ${JSON.stringify(
          sequenceList,
        )}`,
      );
    }
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

export const dynamicAnalysis = (
  repertoire: Repertoire,
  config: AnalysisConfig,
  characters: string[],
  adaptedFrequency: Map<string, number>,
  dictionary: [string, string][],
  algebra: Algebra,
) => {
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

  const segmentMap = new Map<string, string[]>();
  const segmentDynamicAnalysis = new Map<string, string[][]>();

  for (const [name, analysis] of componentResults) {
    const maybeCustomDynamicAnalysis = config.analysis.dynamicCustomize?.[name];
    if (maybeCustomDynamicAnalysis) {
      segmentDynamicAnalysis.set(name, maybeCustomDynamicAnalysis);
    } else if ("schemes" in analysis) {
      segmentDynamicAnalysis.set(
        name,
        analysis.schemes.filter((x) => x.optional).map((x) => x.roots),
      );
    } else {
      segmentDynamicAnalysis.set(name, [analysis.sequence]);
    }
  }
  const sortedCompounds = topologicalSort(repertoire, compounds, config);
  for (const name of segmentDynamicAnalysis.keys()) {
    segmentMap.set(name, [name]);
  }
  for (const [name, compound] of sortedCompounds) {
    const isCurrentRoots =
      config.primaryRoots.has(name) || config.secondaryRoots.has(name);
    const isOptionalRoots = config.optionalRoots.has(name);
    // 必选字根
    if (isCurrentRoots && !isOptionalRoots) {
      segmentDynamicAnalysis.set(name, [[name]]);
      segmentMap.set(name, [name]);
      continue;
    }
    const glyph = compound.glyph;
    const order =
      glyph.order ??
      glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
    const sortedOperandList = sortBy(range(glyph.operandList.length), (i) =>
      order.findIndex((b) => b.index === i),
    ).map((i) => glyph.operandList[i]!);
    const componentList: string[] = [];
    for (const child of sortedOperandList) {
      console.assert(segmentMap.has(child), `${child} not found`);
      componentList.push(...segmentMap.get(child)!);
    }
    // 可选字根
    if (isOptionalRoots) {
      let dynamic: string[][] = [[]];
      for (const operand of componentList) {
        console.assert(
          segmentDynamicAnalysis.has(operand),
          `${operand} not found`,
        );
        const dynamicAnalysis = segmentDynamicAnalysis.get(operand)!;
        dynamic = dynamic
          .map((x) => dynamicAnalysis.map((y) => x.concat(y)))
          .flat();
      }
      segmentDynamicAnalysis.set(name, [[name]].concat(dynamic));
      segmentMap.set(name, [name]);
      continue;
    }
    // 非字根
    segmentMap.set(name, componentList);
  }
  for (const [segment, methods] of segmentDynamicAnalysis) {
    const last = methods[methods.length - 1]!;
    if (!last.every((x) => !config.optionalRoots.has(x))) {
      console.warn(
        `Dynamic analysis for ${segment} ${segment.codePointAt(
          0,
        )} contains optional roots: ${JSON.stringify(last)}`,
      );
    }
  }
  const rootSequence = getRootSequence(repertoire, config);
  const all = characters.map((x) => {
    const readings = repertoire[x]?.readings ?? [];
    const frequency = adaptedFrequency.get(x) ?? 0;
    const frequencies = readings.map(({ pinyin, importance }) => ({
      拼音: pinyin,
      频率: Math.round((frequency * importance) / 100),
      声: applyRules("声", algebra["声"] ?? [], pinyin),
      韵: applyRules("韵", algebra["韵"] ?? [], pinyin),
    }));
    return {
      汉字: x,
      通规: repertoire[x]?.tygf ?? 0,
      频率: frequency,
      读音: frequencies,
      拆分: segmentMap.get(x) ?? [],
    };
  });
  const words = dictionary.map(([word, pinyin]) => ({
    词语: word,
    拼音: pinyin.split(" "),
    频率: adaptedFrequency.get(word) ?? 0,
  }));
  return {
    固定拆分: all,
    动态拆分: Object.fromEntries(segmentDynamicAnalysis),
    字根笔画: Object.fromEntries(rootSequence),
    词语读音频率: words,
  };
};
