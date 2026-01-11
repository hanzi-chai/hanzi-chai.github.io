import { isEqual, sortBy } from "lodash-es";
import { classifier, Classifier } from "./classifier.js";
import type { 部件分析结果, 部件分析 } from "./component.js";
import type { 复合体分析结果, SerializerType } from "./compound.js";
import { 默认复合体分析器 } from "./compound.js";
import type {
  Algebra,
  Analysis,
  CustomGlyph,
  CustomReadings,
  Element,
  Value,
} from "./config.js";
import type {
  Compound,
  Character,
  Repertoire,
  PrimitiveRepertoire,
  SVGGlyph,
  Glyph,
  BasicComponent,
  SVGGlyphWithBox,
  Reading,
} from "./data.js";
import { range } from "d3-array";
import {
  type Dictionary,
  getDummyBasicComponent,
  isComponent,
  isPUA,
} from "./utils.js";
import { 部件图形, 默认部件分析器 } from "./component.js";
import { affineMerge } from "./affine.js";

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
    let selectedGlyph = glyphs[0];
    for (const tag of tags) {
      const withTag = glyphs.find((x) => (x.tags ?? []).includes(tag));
      if (withTag !== undefined) {
        selectedGlyph = withTag;
        break;
      }
    }
    const rawglyph =
      customGlyph[name] ?? selectedGlyph ?? getDummyBasicComponent();
    const glyph = recursiveHandleRawGlyph(rawglyph, repertoire, glyphCache);
    if (glyph instanceof Error) {
      throw glyph;
    }
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
 * 递归渲染一个部件（基本部件或者衍生部件）
 * 如果是基本部件就直接返回，如果是衍生部件则先渲染源字的图形，然后解引用得到这个部件的图形
 *
 * @param component - 部件
 * @param repertoire - 原始字符集
 * @param glyphCache - 部件缓存
 *
 * @returns 部件的 SVG 图形
 * @throws Error 无法渲染
 */
function recursiveHandleRawGlyph(
  glyph: Glyph,
  repertoire: PrimitiveRepertoire,
  glyphCache: Map<string, SVGGlyph> = new Map(),
  depth = 0,
): BasicComponent | Compound | Error {
  if (depth > 100) {
    console.error("Recursion depth exceeded", glyph);
    return new Error();
  }
  if (glyph.type === "derived_component") {
    const sourceCharacter = repertoire[glyph.source];
    if (sourceCharacter === undefined) return new Error();
    const sourceComponent = sourceCharacter.glyphs.find(isComponent);
    if (sourceComponent === undefined) return new Error();
    const sourceGlyph = recursiveHandleRawGlyph(
      sourceComponent,
      repertoire,
      glyphCache,
      depth + 1,
    );
    if (sourceGlyph instanceof Error || sourceGlyph.type !== "basic_component")
      return new Error();
    const svgglyph: SVGGlyph = [];
    glyph.strokes.forEach((x) => {
      if (x.feature === "reference") {
        const sourceStroke = sourceGlyph.strokes[x.index];
        // 允许指标越界
        if (sourceStroke === undefined) return;
        svgglyph.push(sourceStroke);
      } else {
        svgglyph.push(x);
      }
    });
    return {
      type: "basic_component",
      tags: glyph.tags,
      strokes: svgglyph instanceof Error ? [] : svgglyph,
    };
  }
  if (glyph.type === "spliced_component") {
    const glyphs: SVGGlyphWithBox[] = [];
    for (const name of glyph.operandList) {
      const sourceComponent = repertoire[name]?.glyphs?.find?.(isComponent);
      if (sourceComponent === undefined) return new Error();
      const sourceGlyph = recursiveHandleRawGlyph(
        sourceComponent,
        repertoire,
        glyphCache,
        depth + 1,
      );
      if (
        sourceGlyph instanceof Error ||
        sourceGlyph.type !== "basic_component"
      )
        return new Error();
      const box = getGlyphBoundingBox(sourceGlyph.strokes);
      glyphs.push({ strokes: sourceGlyph.strokes, box });
    }
    const asCompound = { ...glyph, type: "compound" as const };
    const svgglyph = affineMerge(asCompound, glyphs).strokes;
    return {
      type: "basic_component",
      tags: glyph.tags,
      strokes: svgglyph instanceof Error ? [] : svgglyph,
    };
  } else if (glyph.type === "identity") {
    return recursiveHandleRawGlyph(
      repertoire[glyph.source]!.glyphs[0]!,
      repertoire,
      glyphCache,
      depth + 1,
    );
  } else {
    return glyph;
  }
}

export interface AnalysisResult {
  componentResults: 部件分析结果;
  componentError: string[];
  customizations: 部件分析结果;
  customized: 部件分析结果;
  compoundResults: 复合体分析结果;
  compoundError: string[];
  rootSequence: Map<string, number[]>;
}

export interface AnalysisConfig {
  analysis: Analysis;
  roots: Map<Element, Value>;
  optionalRoots: Set<Element>;
  classifier: Classifier;
}

export class 字库 {
  private repertoire: Repertoire;

  constructor(repertoire: Repertoire) {
    this.repertoire = repertoire;
  }

  getReadings(character: string): Reading[] | undefined {
    return this.repertoire[character]?.readings;
  }

  getGlyph(character: string): Glyph | undefined {
    return this.repertoire[character]?.glyph;
  }

  /**
   * 确定需要分析的字符
   */
  获取待分析对象(config: AnalysisConfig, characters: string[]) {
    const queue = [...characters];
    const componentsWithStrokes: [string, number][] = [];
    const knownSet = new Set<string>(characters);
    const reverseCompoundMap = new Map<string, Set<string>>();
    const noIncoming: string[] = [];
    while (queue.length) {
      const char = queue.shift()!;
      const glyph = this.repertoire[char]!.glyph;
      if (glyph.type === "compound") {
        // 如果复合体是必选字根，则不继续拆分
        const isCurrentRoot = config.roots.has(char);
        const isOptionalRoot = config.optionalRoots.has(char);
        if (isCurrentRoot && !isOptionalRoot) {
          noIncoming.push(char);
        } else {
          glyph.operandList.forEach((x) => {
            if (!knownSet.has(x)) {
              knownSet.add(x);
              queue.push(x);
            }
            if (!reverseCompoundMap.has(x)) {
              reverseCompoundMap.set(x, new Set());
            }
            reverseCompoundMap.get(x)!.add(char);
          });
        }
      } else {
        componentsWithStrokes.push([char, glyph.strokes.length]);
        noIncoming.push(char);
      }
    }
    // 对字符集进行拓扑排序，得到复合体的拆分顺序
    const 部件列表 = sortBy(componentsWithStrokes, (x) => x[1]).map(
      ([name, _]) => name,
    );
    const componentsSet = new Set(部件列表);
    const sortedCharacters: string[] = [];
    while (noIncoming.length) {
      const char = noIncoming.shift()!;
      sortedCharacters.push(char);
      const dependents = reverseCompoundMap.get(char) ?? new Set();
      reverseCompoundMap.delete(char);
      for (const dependent of dependents) {
        const operands = (this.repertoire[dependent]!.glyph as Compound)
          .operandList;
        if (operands.every((x) => !reverseCompoundMap.has(x))) {
          noIncoming.push(dependent);
        }
      }
    }
    const 复合体列表 = sortedCharacters.filter((x) => !componentsSet.has(x));
    return { 部件列表, 复合体列表 };
  }

  /**
   * 将所有的字根都计算成 ComputedComponent
   *
   * @param repertoire - 字符集
   * @param config - 配置
   *
   * @returns 所有计算后字根的列表
   */
  renderRootList(elements: string[]) {
    const rootList: Map<string, 部件图形> = new Map();
    for (const root of elements) {
      const glyph = this.repertoire[root]?.glyph;
      if (glyph === undefined) continue;
      if (glyph.type === "basic_component") {
        rootList.set(root, new 部件图形(root, glyph.strokes));
      } else {
        const rendered = this.recursiveRenderCompound(glyph, this.repertoire);
        if (rendered instanceof Error) continue;
        rootList.set(root, new 部件图形(root, rendered.strokes));
      }
    }
    return rootList;
  }

  /**
   * 将复合体递归渲染为 SVG 图形
   *
   * @param compound - 复合体
   * @param repertoire - 原始字符集
   *
   * @returns SVG 图形
   * @throws Error 无法渲染
   */
  recursiveRenderCompound = (
    compound: Compound,
    glyphCache: Map<string, SVGGlyphWithBox> = new Map(),
  ): SVGGlyphWithBox | Error => {
    const glyphs: SVGGlyphWithBox[] = [];
    for (const char of compound.operandList) {
      const glyph = this.repertoire[char]?.glyph;
      if (glyph === undefined) return new Error();
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
        const rendered = this.recursiveRenderCompound(glyph, glyphCache);
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
   * @throws Error 无法渲染
   */
  recursiveRenderStrokeSequence = (
    compound: Compound,
    sequenceCache: Map<string, string> = new Map(),
  ): string | Error => {
    const sequences: string[] = [];
    for (const char of compound.operandList) {
      const glyph = this.repertoire[char]?.glyph;
      if (glyph === undefined) return new Error();
      if (glyph.type === "basic_component") {
        sequences.push(
          glyph.strokes.map((x) => classifier[x.feature]).join(""),
        );
      } else {
        const cache = sequenceCache.get(char);
        if (cache !== undefined) {
          sequences.push(cache);
          continue;
        }
        const rendered = this.recursiveRenderStrokeSequence(
          glyph,
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
}

const prepareCustomization = (
  config: AnalysisConfig,
  componentResults: 部件分析结果,
) => {
  const customizations: 部件分析结果 = new Map();
  const customConfig = config.analysis?.customize ?? {};
  for (const [component, sequence] of Object.entries(customConfig)) {
    const previousResult = componentResults.get(component);
    if (previousResult === undefined) continue;
    const refinedResult = { ...previousResult, sequence, full: sequence };
    const maybeBetter = previousResult.全部拆分方式.find((x) => {
      return isEqual(x.拆分方式, sequence);
    });
    if (maybeBetter !== undefined) {
      refinedResult.当前拆分方式 = maybeBetter;
    }
    customizations.set(component, refinedResult);
  }
  const dynamicCustomConfig = config.analysis?.dynamic_customize ?? {};
  for (const [component, sequenceList] of Object.entries(dynamicCustomConfig)) {
    const previousResult = componentResults.get(component);
    if (previousResult === undefined) continue;
    for (const sequence of sequenceList) {
      if (!sequence.every((x) => /\d/.test(x) || config.roots.has(x))) continue;
      const refinedResult = { ...previousResult, sequence, full: sequence };
      customizations.set(component, refinedResult);
      break;
    }
  }
  return customizations;
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
  const 字库实例 = new 字库(repertoire);
  const rootMap = 字库实例.renderRootList([
    ...config.roots.keys(),
    ...config.optionalRoots.keys(),
  ]);
  const { 部件列表, 复合体列表 } = 字库实例.获取待分析对象(config, characters);
  const 部件分析器 = new 默认部件分析器(config, rootMap);
  const 部件结果 = 部件分析器.分析(字库实例, 部件列表);
  if (部件结果 instanceof Error) {
    throw 部件结果;
  }
  const 部件结果定制 = prepareCustomization(config, 部件结果);
  const 定制化部件结果 = new Map([...部件结果, ...部件结果定制]);
  const 复合体分析器 = new 默认复合体分析器(config);
  const 复合体结果 = 复合体分析器.分析(字库实例, 复合体列表, 定制化部件结果);
  const 字根笔画 = new Map<string, number[]>();
  for (const [name, component] of rootMap) {
    字根笔画.set(
      name,
      component.glyph.map((x) => x.feature).map((x) => config.classifier[x]),
    );
  }
  return {
    componentResults,
    customizations: 部件结果定制,
    customized: 定制化部件结果,
    compoundResults,
    rootSequence: 字根笔画,
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
  const rootMap = renderRootList(repertoire, [
    ...config.roots.keys(),
    ...config.optionalRoots.keys(),
  ]);
  const { components, compounds } = getRequiredTargets(
    repertoire,
    config,
    characters,
  );
  const [componentResults, componentError] = disassembleComponents(
    repertoire,
    config,
    components,
    rootMap,
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
    const dynamicAnalysis = analysis.schemes
      .filter((x) => x.optional)
      .map((x) => x.roots);
    segmentDynamicAnalysis.set(
      name,
      maybeCustomDynamicAnalysis ?? dynamicAnalysis,
    );
    segmentMap.set(name, [name]);
  }
  const classifier = config.classifier;
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
    const cache = new 部件图形(name, glyph);
    console.log(
      `Part: ${part} (${part.codePointAt(0)}) [${start}${end ? `-${end}` : ""}]`,
    );
    const analysis = cache.getComponentScheme(
      rootMap,
      config,
      classifier,
    ) as 部件分析;
    segmentDynamicAnalysis.set(
      name,
      analysis.全部拆分方式.filter((x) => x.可用).map((x) => x.拆分方式),
    );
    segmentMap.set(name, [name]);
    return name;
  };

  // 只用于飞花
  const fullSegmentMap = new Map<string, string[]>(segmentMap.entries());

  // 处理复合体的字块映射，如果它同时也作为字块，就处理它的动态拆分
  for (const name of compounds) {
    const glyph = repertoire[name]!.glyph as Compound;
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
        if (!compounds.includes(only)) {
          componentList.push(...fullSegmentMap.get(only)!.slice(0, 2));
        } else {
          const subglyph = repertoire[only]!.glyph as Compound;
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

  const 字根笔画 = new Map<string, number[]>();
  for (const [name, component] of rootMap) {
    字根笔画.set(
      name,
      component.glyph.map((x) => x.feature).map((x) => classifier[x]),
    );
  }

  const result: 动态拆分 = {
    汉字信息,
    多字词信息,
    动态拆分: Object.fromEntries(segmentDynamicAnalysis),
    字根笔画: Object.fromEntries(字根笔画),
  };
  return result;
};
