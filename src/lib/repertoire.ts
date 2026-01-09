import { isEqual, sortBy } from "lodash-es";
import { mergeClassifier } from "./classifier";
import type {
  ComponentResults,
  ComponentBasicAnalysis,
  ComponentGenuineAnalysis,
  ComponentAnalysis,
} from "./component";
import {
  computeComponent,
  disassembleComponents,
  getComponentScheme,
  recursiveRenderComponent,
  renderRootList,
} from "./component";
import type { CompoundResults, SerializerType } from "./compound";
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
  Value,
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
import { type Dictionary, getDummyBasicComponent, isPUA } from "./utils";
import { 变换器, 应用变换器 } from "./transformer";

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
    const rawglyph =
      customGlyph[name]! ?? glyphs[selectedIndex] ?? getDummyBasicComponent();
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
  roots: Map<Element, Value>;
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
    ...config.roots.keys(),
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
    const glyph = repertoire[char]!.glyph;
    if (glyph.type === "compound") {
      compounds.add(char);
      const isCurrentRoot = config.roots.has(char);
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
    if (previousResult === undefined) continue;
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
  const all = new Set([...config.roots.keys()]);
  for (const [component, sequenceList] of Object.entries(
    config.analysis?.dynamic_customize ?? {},
  )) {
    const previousResult = componentResults.get(
      component,
    ) as ComponentGenuineAnalysis;
    for (const sequence of sequenceList) {
      if (!sequence.every((x) => /\d/.test(x) || all.has(x))) continue;
      const pseudoResult: ComponentGenuineAnalysis = {
        ...previousResult,
        sequence: sequence,
        full: sequence,
      };
      customizations.set(component, pseudoResult);
      break;
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

interface 动态拆分 {
  汉字信息: {
    汉字: string;
    通规: 0 | 1 | 2 | 3;
    gb2312: 0 | 1 | 2;
    频率: number;
    读音: {
      拼音: string;
      频率: number;
      [key: string]: any;
    }[];
    字块: string[];
  }[];
  多字词信息: {
    词: string;
    频率: number;
    读音: {
      拼音: string;
      [key: string]: any;
    }[];
  }[];
  动态拆分: Record<string, string[][]>;
  字根笔画: Record<string, number[]>;
}

export const dynamicAnalysis = (
  repertoire: Repertoire,
  config: AnalysisConfig,
  characters: string[],
  dictionary: Dictionary,
  adaptedFrequency: Map<string, number>,
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

  // 字块映射：把一个字表示为若干个字块
  const segmentMap = new Map<string, string[]>();
  // 动态拆分：一个字块有若干种拆分方式
  const segmentDynamicAnalysis = new Map<string, string[][]>();
  // 部首映射：只用于飞花
  const bushouMap = new Map<string, string>();

  // 处理部件作为字块的动态拆分，而字块映射是它自己
  for (const [name, analysis] of componentResults) {
    const maybeCustomDynamicAnalysis =
      config.analysis.dynamic_customize?.[name];
    const dynamicAnalysis =
      "schemes" in analysis
        ? analysis.schemes.filter((x) => x.optional).map((x) => x.roots)
        : [analysis.sequence];
    segmentDynamicAnalysis.set(
      name,
      maybeCustomDynamicAnalysis ?? dynamicAnalysis,
    );
    segmentMap.set(name, [name]);
  }
  const sortedCompounds = topologicalSort(repertoire, compounds, config);
  const rootMap = renderRootList(repertoire, [
    ...config.roots.keys(),
    ...config.optionalRoots.keys(),
  ]);
  const classifier = mergeClassifier(config.analysis?.classifier);
  const rootList = [...rootMap.values()];
  const cachedGetSegment = (part: string, start: number, end?: number) => {
    const character = repertoire[part]!;
    const name = `${isPUA(part) ? character.name : part}.${start}-${end ?? 0}`;
    if (segmentDynamicAnalysis.has(name)) {
      return name;
    }
    if (character.glyph.type !== "basic_component") {
      console.log(`Cannot segment non-basic component: ${part}`);
      return name;
    }
    const glyph = (character.glyph as BasicComponent).strokes.slice(start, end);
    const cache = computeComponent(name, glyph);
    console.log(
      `Part: ${part} (${part.codePointAt(0)}) [${start}${end ? `-${end}` : ""}]`,
    );
    const analysis = getComponentScheme(
      cache,
      rootList,
      config,
      classifier,
    ) as ComponentGenuineAnalysis;
    segmentDynamicAnalysis.set(
      name,
      analysis.schemes.filter((x) => x.optional).map((x) => x.roots),
    );
    segmentMap.set(name, [name]);
    return name;
  };

  // 只用于飞花
  const fullSegmentMap = new Map<string, string[]>(segmentMap.entries());

  // 处理复合体的字块映射，如果它同时也作为字块，就处理它的动态拆分
  for (const [name, compound] of sortedCompounds) {
    const isCurrentRoots = config.roots.has(name);
    const isOptionalRoots = config.optionalRoots.has(name);
    // 如果复合体是必选字根，则直接视为一个字块
    if (isCurrentRoots && !isOptionalRoots) {
      segmentDynamicAnalysis.set(name, [[name]]);
      segmentMap.set(name, [name]);
      fullSegmentMap.set(name, [name]);
      continue;
    }

    // 找出复合体对应的字块
    const glyph = compound.glyph;
    const componentList: string[] = [];
    const order =
      glyph.order ??
      glyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
    if (config.analysis.serializer === ("qingyun" as SerializerType)) {
      const seenIndex = new Map<number, number>();
      for (const { index, strokes } of order) {
        const part = glyph.operandList[index]!;
        if (strokes === 0) {
          if (!seenIndex.has(index)) {
            componentList.push(...segmentMap.get(part)!);
          } else {
            const start = seenIndex.get(index)!;
            const name = cachedGetSegment(part, start);
            componentList.push(name);
          }
        } else {
          const start = seenIndex.get(index) ?? 0;
          const end = start + strokes;
          const name = cachedGetSegment(part, start, end);
          componentList.push(name);
          seenIndex.set(index, end);
        }
      }
    } else if (config.analysis.serializer === ("feihua" as SerializerType)) {
      // 飞花需要处理部首
      const sortedOperandList = sortBy(range(glyph.operandList.length), (i) =>
        order.findIndex((b) => b.index === i),
      ).map((i) => glyph.operandList[i]!);
      const fullComponentList: string[] = [];
      for (const child of sortedOperandList) {
        fullComponentList.push(...fullSegmentMap.get(child)!);
      }
      fullSegmentMap.set(name, fullComponentList);
      // 判断部首：第一个或最后一个恰好为一字根
      const first = sortedOperandList[0]!;
      const last = sortedOperandList.at(-1)!;
      const firstDynamic = segmentDynamicAnalysis.get(first);
      const lastDynamic = segmentDynamicAnalysis.get(last);
      const res: string[] = [];
      if (
        /[⿴⿵⿶⿷⿸⿹⿺⿼⿽⿻]/.test(glyph.operator) &&
        componentResults.has(glyph.operandList[0]!)
      ) {
        bushouMap.set(
          name,
          segmentDynamicAnalysis.get(glyph.operandList[0]!)![0]![0]!,
        );
        res.push(...glyph.operandList.slice(1));
      } else if (
        firstDynamic?.[0]?.length === 1 &&
        lastDynamic?.[0]?.length === 1 &&
        /[又]/.test(firstDynamic[0]![0]!)
      ) {
        bushouMap.set(name, lastDynamic[0]![0]!);
        res.push(...sortedOperandList.slice(0, -1));
      } else if (firstDynamic?.[0]?.length === 1) {
        bushouMap.set(name, firstDynamic[0]![0]!);
        res.push(...sortedOperandList.slice(1));
      } else if (lastDynamic?.[0]?.length === 1) {
        bushouMap.set(name, lastDynamic[0]![0]!);
        res.push(...sortedOperandList.slice(0, -1));
      } else {
        const firstSegments = fullSegmentMap.get(first)!;
        const segment = firstSegments[0]!;
        const bushou = segmentDynamicAnalysis.get(segment)![0]![0]!;
        bushouMap.set(name, bushou);
        res.push(...sortedOperandList.slice(1));
      }
      if (res.length === 1) {
        const only = res[0]!;
        if (!sortedCompounds.has(only)) {
          componentList.push(...fullSegmentMap.get(only)!.slice(0, 2));
        } else {
          const subglyph = sortedCompounds.get(only)!.glyph;
          const order =
            subglyph.order ??
            subglyph.operandList.map((_, i) => ({ index: i, strokes: 0 }));
          const sortedOperandList = sortBy(
            range(subglyph.operandList.length),
            (i) => order.findIndex((b) => b.index === i),
          ).map((i) => subglyph.operandList[i]!);
          for (const part of sortedOperandList) {
            componentList.push(...fullSegmentMap.get(part)![0]!);
          }
        }
      } else {
        for (const child of res) {
          componentList.push(fullSegmentMap.get(child)![0]!);
        }
      }
    } else {
      const sortedOperandList = sortBy(range(glyph.operandList.length), (i) =>
        order.findIndex((b) => b.index === i),
      ).map((i) => glyph.operandList[i]!);
      for (const child of sortedOperandList) {
        componentList.push(...segmentMap.get(child)!);
      }
    }
    if (isOptionalRoots) {
      let dynamic: string[][] = [[]];
      for (const operand of componentList) {
        const dynamicAnalysis = segmentDynamicAnalysis.get(operand)!;
        dynamic = dynamic
          .map((x) => dynamicAnalysis.map((y) => x.concat(y)))
          .flat();
      }
      segmentDynamicAnalysis.set(name, [[name]].concat(dynamic));
      segmentMap.set(name, [name]);
    } else {
      segmentMap.set(name, componentList);
    }
  }
  const 汉字信息 = characters.map((x) => {
    const readings = repertoire[x]?.readings ?? [];
    const frequency = adaptedFrequency.get(x) ?? 0;
    const frequencies = readings.map(({ pinyin, importance }) => {
      const entry: any = {
        拼音: pinyin,
        频率: Math.round((frequency * importance) / 100),
      };
      for (const [name, rules] of Object.entries(algebra)) {
        entry[name] = applyRules(name, rules, pinyin);
      }
      return entry;
    });
    return {
      汉字: x,
      通规: repertoire[x]!.tygf,
      gb2312: repertoire[x]!.gb2312,
      频率: frequency,
      读音: frequencies,
      字块: segmentMap.get(x) ?? [],
      部首: bushouMap.get(x),
    };
  });
  const 多字词信息 = dictionary.map(([word, syllables]) => {
    const frequency = adaptedFrequency.get(word) ?? 0;
    const readings = syllables.split(" ").map((pinyin) => {
      const entry: any = {
        拼音: pinyin,
      };
      for (const [name, rules] of Object.entries(algebra)) {
        entry[name] = applyRules(name, rules, pinyin);
      }
      return entry;
    });
    return {
      词: word,
      频率: frequency,
      读音: readings,
    };
  });

  const result: 动态拆分 = {
    汉字信息,
    多字词信息,
    动态拆分: Object.fromEntries(segmentDynamicAnalysis),
    字根笔画: Object.fromEntries(getRootSequence(repertoire, config)),
  };
  return result;
};
