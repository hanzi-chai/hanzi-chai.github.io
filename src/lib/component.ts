import type { SieveName } from "./config";
import type {
  Repertoire,
  PrimitiveRepertoire,
  SVGGlyph,
  Component,
} from "./data";
import { defaultDegenerator, generateSliceBinaries } from "./degenerator";
import { select } from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import type { CornerSpecifier, RenderedGlyph, Topology } from "./topology";
import { findCorners, findTopology, renderSVGGlyph } from "./topology";
import { mergeClassifier, type Classifier } from "./classifier";
import { isComponent } from "./utils";
import type { AnalysisConfig } from "./repertoire";
import { recursiveRenderCompound } from "./compound";

export class InvalidGlyphError extends Error {}

export const makeIntervalSum = (strokes: number, rootsSet: Set<number>) => {
  const array = [...Array(strokes).keys()].map((x) => 1 << x).reverse();
  const intervalSums = new Set<number>();
  for (let start = 0; start !== strokes - 1; ++start) {
    let sum = array[start]!;
    for (let end = start + 1; end !== strokes; ++end) {
      sum += array[end]!;
      if (rootsSet.has(sum)) {
        intervalSums.add(sum);
      }
    }
  }
  return intervalSums;
};

/**
 * 根据一个部件中包含的所有字根的情况，导出所有可能的拆分方案
 *
 * @param strokes - 部件笔画数
 * @param roots - 部件包含的字根列表，其中每个字根用二进制表示
 *
 * 函数通过递归的方式，每次选取剩余部分的第一笔，然后在字根列表中找到包含这个笔画的所有字根
 * 将这些可能性与此前已经拆分的部分组合，得到新的拆分方案
 * 直到所有的笔画都使用完毕
 */
export const generateSchemes = (strokes: number, roots: number[]) => {
  const rootsSet = new Set(roots);
  const schemeList: number[][] = [];
  const total = (1 << strokes) - 1;
  const intervalSums = makeIntervalSum(strokes, rootsSet);
  const combineNext = (
    partialSum: number,
    scheme: number[],
    revcumsum: number[],
  ) => {
    const restBin = total - partialSum;
    const restBin1st = 1 << (restBin.toString(2).length - 1);
    const start = bisectLeft(roots, restBin1st);
    const end = bisectRight(roots, restBin);
    for (const binary of roots.slice(start, end)) {
      if ((partialSum & binary) !== 0) continue;
      const newPartialSum = partialSum + binary;
      const newRevcumsum = revcumsum.map((x) => x + binary);
      const newScheme = scheme.concat(binary);
      if (newRevcumsum.some((x) => intervalSums.has(x))) {
        continue;
      }
      newRevcumsum.push(binary);
      if (newPartialSum === total) {
        schemeList.push(newScheme);
      } else {
        combineNext(newPartialSum, newScheme, newRevcumsum);
      }
    }
  };
  combineNext(0, [], []);
  return schemeList;
};

/**
 * 计算后的部件 ComputedComponent
 *
 * 在基本部件 BasicComponent 的基础上，将 SVG 命令转换为参数曲线
 * 再基于参数曲线计算拓扑
 */
export interface ComputedComponent {
  name: string;
  glyph: RenderedGlyph;
  topology: Topology;
  corners: CornerSpecifier;
}

export class NoSchemeError extends Error {}
export class MultipleSchemeError extends Error {}

/**
 * 通过自动拆分算法，给定字根列表，对部件进行拆分
 * @param component - 部件
 * @param rootData - 字根列表
 * @param config - 配置
 * @param classifier - 笔画分类器
 *
 * 如果拆分唯一，则返回拆分结果；否则返回错误
 *
 * @returns 拆分结果
 * @throws NoSchemeError 无拆分方案
 * @throws MultipleSchemeError 多个拆分方案
 */
export const getComponentScheme = function (
  component: ComputedComponent,
  rootData: ComputedComponent[],
  config: AnalysisConfig,
  classifier: Classifier,
): ComponentAnalysis | NoSchemeError | MultipleSchemeError {
  if (
    config.primaryRoots.has(component.name) ||
    config.secondaryRoots.has(component.name)
  )
    return {
      strokes: component.glyph.length,
      sequence: [component.name],
      full: [component.name],
      corners: [0, 0, 0, 0],
      operator: undefined,
    };
  const rootMap = new Map<number, string>(
    component.glyph.map((stroke, index) => {
      const binary = 1 << (component.glyph.length - 1 - index);
      return [binary, classifier[stroke.feature].toString()];
    }),
  );
  for (const root of rootData) {
    const binaries = generateSliceBinaries(
      config.analysis?.degenerator ?? defaultDegenerator,
      component,
      root,
    );
    binaries.forEach((binary) => rootMap.set(binary, root.name));
  }
  const roots = Array.from(rootMap.keys()).sort((a, b) => a - b);
  const schemeList = generateSchemes(component.glyph.length, roots);
  if (schemeList.length === 0) {
    return new NoSchemeError();
  }
  const selectResult = select(config, component, schemeList, rootMap);
  if (selectResult instanceof Error) {
    return selectResult;
  }
  const [best, schemes] = selectResult;
  let sequence = best.scheme.map((n) => rootMap.get(n)!);
  let corners = component.corners.map((corner) =>
    best.scheme.findIndex(
      (x) => x & (1 << (component.glyph.length - corner - 1)),
    ),
  ) as CornerSpecifier;
  if (config.analysis.serializer === "c3") {
    // 根据四角信息对 sequence 进行排序
    // if (sequence.length > 3) {
    //   console.log(component.name, sequence, corners);
    // }
    const newSequence: string[] = [];
    const newCorners: CornerSpecifier = [0, 0, 0, 0];
    newSequence.push(sequence[corners[0]]!);
    if (corners[0] === corners[3]) {
      // 左上角和右下角相同
      sequence.forEach((x, i) => {
        if (i === corners[0]) return;
        if (newSequence.length === 3) return;
        newSequence.push(x);
      });
    } else {
      // 左上角和右下角不同
      let middle: number;
      if (sequence.length > 2) {
        middle = sequence.findIndex(
          (_, i) => i !== corners[0] && i !== corners[3],
        );
      }
      sequence.forEach((x, i) => {
        if (i === corners[3] || i === middle) {
          newSequence.push(x);
        }
        if (i === corners[3]) {
          newCorners[3] = newSequence.length - 1;
        }
      });
    }
    sequence = newSequence;
    corners = newCorners;
  }
  return {
    sequence,
    full: sequence,
    strokes: component.glyph.length,
    map: rootMap,
    best,
    schemes,
    corners,
    operator: undefined,
  };
};

/**
 * 部件的拆分结果
 */
export type ComponentAnalysis =
  | ComponentBasicAnalysis
  | ComponentGenuineAnalysis;

export interface SchemeWithData {
  scheme: number[];
  evaluation: Map<SieveName, number | number[]>;
}

export interface CommonAnalysis {
  sequence: string[];
  full: string[];
  corners: CornerSpecifier;
}

/**
 * 部件本身是字根字，或者是由自定义部件拆分指定的无理拆分，无拆分细节
 */
export interface ComponentBasicAnalysis extends CommonAnalysis {
  strokes: number;
  operator: undefined;
}

/**
 * 部件通过自动拆分算法分析得到的拆分结果的全部细节
 */
export interface ComponentGenuineAnalysis extends ComponentBasicAnalysis {
  map: Map<number, string>;
  best: SchemeWithData;
  schemes: SchemeWithData[];
}

export type ComponentResults = Map<string, ComponentAnalysis>;

/**
 * 递归渲染一个部件（基本部件或者衍生部件）
 * 如果是基本部件就直接返回，如果是衍生部件则先渲染源字的图形，然后解引用得到这个部件的图形
 *
 * @param component - 部件
 * @param repertoire - 原始字符集
 * @param glyphCache - 部件缓存
 *
 * @returns 部件的 SVG 图形
 * @throws InvalidGlyphError 无法渲染
 */
export const recursiveRenderComponent = function (
  component: Component,
  repertoire: PrimitiveRepertoire,
  glyphCache: Map<string, SVGGlyph> = new Map(),
): SVGGlyph | InvalidGlyphError {
  if (component.type === "basic_component") return component.strokes;
  const sourceComponent =
    repertoire[component.source]?.glyphs.find(isComponent);
  if (sourceComponent === undefined) return new InvalidGlyphError();
  const sourceGlyph = recursiveRenderComponent(
    sourceComponent,
    repertoire,
    glyphCache,
  );
  if (sourceGlyph instanceof InvalidGlyphError) return sourceGlyph;
  const glyph: SVGGlyph = [];
  component.strokes.forEach((x) => {
    if (x.feature === "reference") {
      const sourceStroke = sourceGlyph[x.index];
      // 允许指标越界
      if (sourceStroke === undefined) return;
      glyph.push(sourceStroke);
    } else {
      glyph.push(x);
    }
  });
  return glyph;
};

const overrideCorners: Map<string, CornerSpecifier> = new Map([
  ["良", [0, 0, 4, 6]],
  ["\uE06A", [0, 0, 4, 5]],
  ["世", [0, 0, 4, 4]],
  ["中", [0, 1, 3, 3]],
  ["争", [0, 1, 5, 5]],
  ["卡", [0, 0, 3, 3]],
  ["毌", [0, 0, 0, 0]],
  ["自", [0, 0, 5, 5]],
  ["血", [0, 0, 5, 5]],
  ["\uE097", [0, 0, 4, 4]], // 睾字头
  ["乜", [0, 0, 1, 1]],
  ["也", [0, 0, 2, 2]],
  ["㐄", [0, 0, 1, 2]],
  ["义", [0, 0, 2, 2]],
  ["亍", [0, 0, 2, 2]],
  ["丰", [0, 0, 3, 3]],
  ["午", [0, 1, 3, 3]],
  ["巿", [0, 0, 3, 3]],
  ["帀", [0, 0, 3, 3]],
  ["\uE06D", [0, 0, 3, 3]],
  ["\uE0C7", [0, 0, 3, 3]],
  ["\uE0A4", [0, 1, 3, 3]],
  ["乎", [0, 0, 4, 4]],
  ["永", [0, 0, 1, 1]],
  ["申", [0, 0, 4, 4]],
  ["\uE098", [0, 0, 4, 4]],
  ["屰", [0, 1, 5, 5]],
  ["\uE061", [0, 0, 6, 6]], // 敢字旁
  ["\uE067", [0, 1, 7, 7]], // 曾字旁
  ["斥", [0, 0, 3, 3]],
  ["\uE01C", [0, 0, 4, 4]], // 即字旁
  ["串", [0, 0, 6, 6]],
  ["事", [0, 0, 7, 7]],
  ["臾", [0, 0, 7, 7]],
  ["\uE0CB", [0, 0, 5, 5]], // 追字心
  ["州", [0, 0, 5, 5]],
  ["凢", [0, 0, 2, 2]],
  ["首", [0, 1, 8, 8]],
  ["甪", [0, 0, 5, 5]],
  ["\uE13C", [0, 0, 2, 2]],
  ["丯", [0, 0, 3, 3]],
  ["\uEAF3", [0, 0, 2, 2]],
  ["\uE076", [0, 0, 3, 3]],
  ["\uE112", [0, 0, 5, 5]], // 帶字头
  ["\uE158", [0, 0, 3, 3]], // 飛字底
  ["亊", [0, 0, 6, 6]],
  ["\uE16B", [0, 0, 6, 6]], // 龜字心
  ["\uE151", [0, 0, 2, 2]], // 嬽上角框
  ["平", [0, 0, 4, 4]],
  ["乡", [0, 0, 2, 2]],
  ["龜", [0, 0, 6, 6]],
  ["㐧", [0, 0, 2, 2]],
  ["\uE153", [0, 0, 3, 3]], // 虍无七
  ["\uE165", [0, 0, 3, 3]], // 幷字旁
  ["\uE166", [0, 0, 3, 3]], // 幷字边
]);

/**
 * 把一个基本部件从 SVG 图形出发，先渲染成 Bezier 图形，然后计算拓扑
 *
 * 这样，便于后续的字根认同计算
 */
export const computeComponent = (name: string, glyph: SVGGlyph) => {
  const renderedGlyph = renderSVGGlyph(glyph);
  const topology = findTopology(renderedGlyph);
  const corners = overrideCorners.get(name) ?? findCorners(renderedGlyph);
  const cache: ComputedComponent = {
    glyph: renderedGlyph,
    topology,
    corners,
    name,
  };
  return cache;
};

/**
 * 将所有的字根都计算成 ComputedComponent
 *
 * @param repertoire - 字符集
 * @param config - 配置
 *
 * @returns 所有计算后字根的列表
 */
export const renderRootList = (repertoire: Repertoire, elements: string[]) => {
  const rootList: Map<string, ComputedComponent> = new Map();
  for (const root of elements) {
    const glyph = repertoire[root]?.glyph;
    if (glyph === undefined) continue;
    if (glyph.type === "basic_component") {
      rootList.set(root, computeComponent(root, glyph.strokes));
    } else {
      const rendered = recursiveRenderCompound(glyph, repertoire);
      if (rendered instanceof Error) continue;
      rootList.set(root, computeComponent(root, rendered));
    }
  }
  return rootList;
};

/**
 * 对所有部件进行拆分
 *
 * @param repertoire - 字符集
 * @param config - 配置
 *
 * @returns 拆分结果和无法拆分的汉字列表
 */
export const disassembleComponents = function (
  repertoire: Repertoire,
  config: AnalysisConfig,
  characters: string[],
  components: Set<string>,
): [ComponentResults, string[]] {
  const rootMap = renderRootList(repertoire, [
    ...config.primaryRoots,
    ...config.secondaryRoots,
  ]);
  const rootList = [...rootMap.values()];
  const classifier = mergeClassifier(config.analysis?.classifier);
  const result: [string, ComponentAnalysis][] = [];
  const error: string[] = [];
  Object.entries(repertoire).forEach(([name, character]) => {
    if (character.glyph?.type !== "basic_component" || !components.has(name))
      return;
    const cache = rootMap.has(name)
      ? rootMap.get(name)!
      : computeComponent(name, character.glyph.strokes);
    const scheme = getComponentScheme(cache, rootList, config, classifier);
    if (scheme instanceof Error) {
      error.push(name);
    } else {
      result.push([name, scheme]);
    }
  });
  result.sort((a, b) => {
    return a[1].strokes - b[1].strokes;
  });
  return [new Map(result), error];
};
