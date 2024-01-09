import type { FormConfig, SieveName } from "./config";
import type {
  Component,
  Compound,
  DeterminedRepertoire,
  Repertoire,
  SVGGlyph,
} from "./data";
import { generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import type { RenderedGlyph, Topology } from "./topology";
import findTopology, { renderSVGGlyph } from "./topology";
import type { Classifier } from "./classifier";
import { isValidCJKChar, isValidChar } from "./utils";
import classifier from "./classifier";
import { affineMerge } from "./affine";

class UnknownCharError extends Error {}
class InvalidGlyphError extends Error {}

export const recursiveGetSequence = function (
  repertoire: DeterminedRepertoire,
  name: string,
  cache: Map<string, string> = new Map(),
  depth: number = 0,
): number[] | UnknownCharError | InvalidGlyphError {
  if (depth >= 10) {
    return new InvalidGlyphError();
  }
  const cached = cache.get(name);
  if (cached) {
    return Array.from(cached).map(Number);
  }
  const glyph = repertoire[name]?.glyph;
  if (glyph === undefined)
    return new UnknownCharError(
      `Unknown char: ${name}, ${name
        .codePointAt(0)!
        .toString(16)}, ${name.codePointAt(0)!}`,
    );
  if (glyph.type === "component") {
    return glyph.strokes.map((x) => classifier[x.feature]);
  } else {
    const { operandList, order } = glyph;
    const sequences: { sequence: number[]; taken: number }[] = [];
    for (const operand of operandList) {
      const opearndSequence = recursiveGetSequence(
        repertoire,
        operand,
        cache,
        depth + 1,
      );
      if (opearndSequence instanceof Error) return new InvalidGlyphError();
      sequences.push({ sequence: opearndSequence, taken: 0 });
    }
    if (order === undefined) return sequences.map((x) => x.sequence).flat();
    const finalSequence: number[] = [];
    for (const { index, strokes } of order) {
      const sequenceData = sequences[index];
      if (sequenceData === undefined) return new InvalidGlyphError();
      if (strokes === 0) finalSequence.push(...sequenceData.sequence);
      else {
        finalSequence.push(
          ...sequenceData.sequence.slice(sequenceData.taken, strokes),
        );
        sequenceData.taken += strokes;
      }
    }
    return finalSequence;
  }
};

export const getSequence = (
  repertoire: DeterminedRepertoire,
  char: string,
  cache?: Map<string, string>,
) => {
  if (char.match(/\d+/)) return char;
  try {
    const recurseResult = recursiveGetSequence(repertoire, char, cache);
    if (recurseResult instanceof Error) {
      console.error(
        `无法获取笔画（${recurseResult.message}）`,
        char,
        char.codePointAt(0)!.toString(16),
      );
      return "";
    }
    return recurseResult.join("");
  } catch {
    console.error("无法获取笔画", char, char.codePointAt(0)!.toString(16));
    return "";
  }
};

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
  config: FormConfig,
  classifier: Classifier,
): ComponentResult | NoSchemeError | MultipleSchemeError {
  const { mapping } = config;
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
  repertoire: Repertoire,
  glyphCache: Map<string, SVGGlyph> = new Map(),
) {
  const glyph: SVGGlyph = [];
  if (component.source !== undefined) {
    const sourceGlyph = recursiveRenderGlyph(
      component.source,
      repertoire,
      glyphCache,
    );
    if (sourceGlyph instanceof InvalidGlyphError) return sourceGlyph;
    component.strokes.forEach((x) => {
      if (typeof x === "number") {
        const sourceStroke = sourceGlyph[x];
        if (sourceStroke === undefined) return new InvalidGlyphError();
        glyph.push(sourceStroke);
      } else {
        glyph.push(x);
      }
    });
  } else {
    glyph.push(...component.strokes);
  }
  return glyph;
};

export const recursiveRenderCompound = function (
  compound: Compound,
  repertoire: Repertoire,
  glyphCache: Map<string, SVGGlyph> = new Map(),
) {
  const glyphs: SVGGlyph[] = [];
  for (const char of compound.operandList) {
    const maybe = recursiveRenderGlyph(char, repertoire, glyphCache);
    if (maybe instanceof InvalidGlyphError) {
      return maybe;
    }
    glyphs.push(maybe);
  }
  return affineMerge(compound.operator, glyphs);
};

export const recursiveRenderGlyph = function (
  char: string,
  repertoire: Repertoire,
  glyphCache: Map<string, SVGGlyph> = new Map(),
): SVGGlyph | InvalidGlyphError {
  const cache = glyphCache.get(char);
  if (cache) return cache;
  const glyphs = repertoire[char]?.glyphs;
  if (glyphs === undefined) {
    return new InvalidGlyphError();
  }
  let result: SVGGlyph | InvalidGlyphError;
  const component = glyphs.find((x) => x.type === "component");
  if (component !== undefined) {
    result = recursiveRenderComponent(
      component as Component,
      repertoire,
      glyphCache,
    );
  } else {
    const compound = glyphs[0];
    result = recursiveRenderCompound(
      compound as Compound,
      repertoire,
      glyphCache,
    );
  }
  if (!(result instanceof InvalidGlyphError)) {
    glyphCache.set(char, result);
  }
  return result;
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

export const renderRootList = (
  data: DeterminedRepertoire,
  config: FormConfig,
) => {
  const { mapping, grouping } = config;
  const glyphCache = new Map<string, SVGGlyph>();
  const roots = [...Object.keys(mapping), ...Object.keys(grouping)].filter(
    (x) => data[x] !== undefined,
  );
  const rootList: ComputedComponent[] = [];
  for (const root of roots) {
    const glyph = data[root]?.glyph;
    if (glyph?.type === "component") {
      rootList.push(computeComponent(root, glyph.strokes));
    }
  }
  return rootList;
};

export const disassembleComponents = function (
  data: DeterminedRepertoire,
  config: FormConfig,
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
    if (character.glyph?.type !== "component") return;
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
