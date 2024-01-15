import type { Config, KeyboardConfig, SieveName } from "./config";
import type {
  DerivedComponent,
  Compound,
  Repertoire,
  PrimitiveRepertoire,
  SVGGlyph,
  Component,
  BasicComponent,
} from "./data";
import { generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import type { RenderedGlyph, Topology } from "./topology";
import findTopology, { renderSVGGlyph } from "./topology";
import type { Classifier } from "./classifier";
import { isValidCJKChar, isValidChar } from "./utils";
import { affineMerge } from "./affine";

class InvalidGlyphError extends Error {}

export const generateSchemes = (n: number, roots: number[]) => {
  const schemeList: number[][] = [];
  const total = (1 << n) - 1;
  const combineNext = (partialSum: number, scheme: number[]) => {
    const restBin = total - partialSum;
    const restBin1st = 1 << (restBin.toString(2).length - 1);
    const start = bisectLeft(roots, restBin1st);
    const end = bisectRight(roots, restBin);
    for (const binary of roots.slice(start, end)) {
      if ((partialSum & binary) !== 0) continue;
      const newBin = partialSum + binary;
      if (newBin === total) {
        schemeList.push(scheme.concat(binary));
      } else {
        combineNext(newBin, scheme.concat(binary));
      }
    }
  };
  combineNext(0, []);
  return schemeList;
};

export interface ComputedComponent {
  name: string;
  glyph: RenderedGlyph;
  topology: Topology;
}

export class NoSchemeError extends Error {}
export class MultipleSchemeError extends Error {}

const getComponentScheme = function (
  component: ComputedComponent,
  rootData: ComputedComponent[],
  config: Config,
  classifier: Classifier,
): ComponentResult | NoSchemeError | MultipleSchemeError {
  const { mapping } = config.form;
  if (mapping[component.name])
    return {
      sequence: [component.name],
    };
  const rootMap = new Map<number, string>(
    component.glyph.map((stroke, index) => {
      const binary = 1 << (component.glyph.length - 1 - index);
      return [binary, classifier[stroke.feature].toString()];
    }),
  );
  for (const root of rootData) {
    const binaries = generateSliceBinaries(config, component, root);
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
  return {
    sequence,
    detail: detail,
    strokes: component.glyph.length,
    map: rootMap,
    schemes: schemeData.map((v) => {
      return {
        scheme: v.scheme,
        sequence: v.scheme.map((x) => rootMap.get(x)!),
        data: v.evaluation,
      };
    }),
  };
};

export type ComponentResult = ComponentRootResult | ComponentRegularResult;

export interface SchemeWithData {
  sequence: string[];
  scheme: number[];
  data: Map<SieveName, number | number[]>;
}

// 两个以上字根
interface ComponentRegularResult {
  sequence: string[];
  detail: { name: string; binary: number }[];
  strokes: number;
  map: Map<number, string>;
  schemes: SchemeWithData[];
}

// 本身是字根字，无拆分细节
interface ComponentRootResult {
  sequence: string[];
}

export type ComponentCache = Map<string, ComponentResult>;

export const recursiveRenderComponent = function (
  component: Component,
  repertoire: PrimitiveRepertoire,
  glyphCache: Map<string, SVGGlyph> = new Map(),
): SVGGlyph | InvalidGlyphError {
  if (component.type === "basic_component") return component.strokes;
  const sourceComponent = repertoire[component.source]?.glyphs.find(
    (x) => x.type === "basic_component" || x.type === "derived_component",
  ) as BasicComponent | DerivedComponent | undefined;
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

export const computeComponent = (name: string, glyph: SVGGlyph) => {
  const renderedGlyph = renderSVGGlyph(glyph);
  const topology = findTopology(renderedGlyph);
  const cache: ComputedComponent = {
    glyph: renderedGlyph,
    topology,
    name,
  };
  return cache;
};

export const renderRootList = (repertoire: Repertoire, config: Config) => {
  const { mapping, grouping } = config.form;
  const roots = [...Object.keys(mapping), ...Object.keys(grouping)].filter(
    (x) => repertoire[x] !== undefined,
  );
  const rootList: ComputedComponent[] = [];
  for (const root of roots) {
    const glyph = repertoire[root]?.glyph;
    if (glyph === undefined) continue;
    if (glyph.type === "basic_component") {
      rootList.push(computeComponent(root, glyph.strokes));
    } else {
      const rendered = recursiveRenderCompound(glyph, repertoire);
      if (rendered instanceof Error) continue;
      const cache = computeComponent(root, rendered);
      rootList.push(cache);
    }
  }
  return rootList;
};

export const disassembleComponents = function (
  data: Repertoire,
  config: Config,
  classifier: Classifier,
): [ComponentCache, string[]] {
  const rootList = renderRootList(data, config);
  const composables = new Set<string>();
  for (const { glyph } of Object.values(data)) {
    if (glyph?.type !== "compound") continue;
    glyph!.operandList.forEach((x) => composables.add(x));
  }
  const result: ComponentCache = new Map();
  const error: string[] = [];
  Object.entries(data).forEach(([name, character]) => {
    if (character.glyph?.type !== "basic_component") return;
    const cache = computeComponent(name, character.glyph.strokes);
    if (!isValidCJKChar(name) && !composables.has(name)) {
      return;
    }
    const scheme = getComponentScheme(cache, rootList, config, classifier);
    if (scheme instanceof Error) {
      error.push(name);
    } else {
      result.set(name, scheme);
    }
  });
  return [result, error];
};
