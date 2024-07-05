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
      corners: [0, 0, 0, 0],
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
  const [bestScheme, schemeData] = selectResult;
  const sequence = bestScheme.map((n) => rootMap.get(n)!);
  const detail = bestScheme.map((n) => ({ name: rootMap.get(n)!, binary: n }));
  const schemes = schemeData.map((v) => {
    return {
      scheme: v.scheme,
      sequence: v.scheme.map((x) => rootMap.get(x)!),
      data: v.evaluation,
    };
  });
  const corners = component.corners.map((corner) =>
    bestScheme.findIndex(
      (x) => x & (1 << (component.glyph.length - corner - 1)),
    ),
  ) as CornerSpecifier;
  return {
    sequence,
    detail,
    strokes: component.glyph.length,
    map: rootMap,
    schemes,
    corners,
  };
};

/**
 * 部件的拆分结果
 */
export type ComponentAnalysis =
  | ComponentBasicAnalysis
  | ComponentGenuineAnalysis;

export interface SchemeWithData {
  sequence: string[];
  scheme: number[];
  data: Map<SieveName, number | number[]>;
}

/**
 * 部件本身是字根字，或者是由自定义部件拆分指定的无理拆分，无拆分细节
 */
export interface ComponentBasicAnalysis {
  strokes: number;
  sequence: string[];
  corners: CornerSpecifier;
}

/**
 * 部件通过自动拆分算法分析得到的拆分结果的全部细节
 */
interface ComponentGenuineAnalysis extends ComponentBasicAnalysis {
  detail: { name: string; binary: number }[];
  map: Map<number, string>;
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

const getLeafComponents = (
  repertoire: Repertoire,
  config: AnalysisConfig,
  characters: string[],
) => {
  const queue = [...characters];
  const leafSet = new Set<string>();
  const knownSet = new Set<string>(characters);
  while (queue.length) {
    const char = queue.shift()!;
    const glyph = repertoire[char]!.glyph!;
    if (!glyph) {
      continue;
    }
    if (glyph.type === "compound") {
      if (config.primaryRoots.has(char) || config.secondaryRoots.has(char))
        continue;
      glyph.operandList.forEach((x) => {
        if (!knownSet.has(x)) {
          knownSet.add(x);
          queue.push(x);
        }
      });
    } else {
      leafSet.add(char);
    }
  }
  return leafSet;
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
): [ComponentResults, string[]] {
  const leafSet = getLeafComponents(repertoire, config, characters);
  const rootMap = renderRootList(repertoire, [
    ...config.primaryRoots,
    ...config.secondaryRoots,
  ]);
  const rootList = [...rootMap.values()];
  const classifier = mergeClassifier(config.analysis?.classifier);
  const result: [string, ComponentAnalysis][] = [];
  const error: string[] = [];
  Object.entries(repertoire).forEach(([name, character]) => {
    if (character.glyph?.type !== "basic_component" || !leafSet.has(name))
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
