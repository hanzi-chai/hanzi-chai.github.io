import type { FormConfig, MergedData, SieveName } from "./config";
import type { Component, Compound, Form, SVGGlyph } from "./data";
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
  form: Form,
  char: string,
  cache: Map<string, string> = new Map(),
  depth: number = 0,
): number[] | UnknownCharError | InvalidGlyphError {
  if (depth >= 10) {
    return new InvalidGlyphError();
  }
  const cached = cache.get(char);
  if (cached) {
    return Array.from(cached).map(Number);
  }
  const glyph = form[char];
  if (!glyph)
    return new UnknownCharError(
      `Unknown char: ${char}, ${char
        .codePointAt(0)!
        .toString(16)}, ${char.codePointAt(0)!}`,
    );
  const { component, compound } = glyph;
  if (component !== undefined) {
    if (component.source !== undefined) {
      const sourceSequence = recursiveGetSequence(
        form,
        component.source,
        cache,
        depth + 1,
      );
      if (sourceSequence instanceof Error) return new InvalidGlyphError();
      const strokes: number[] = [];
      component.strokes.forEach((x) => {
        if (typeof x === "number") {
          const sourceClass = sourceSequence[x];
          if (sourceClass !== undefined) {
            strokes.push(sourceClass);
          } else {
            return new InvalidGlyphError();
          }
        } else {
          strokes.push(classifier[x.feature]);
        }
      });
      return strokes;
    }
    return component.strokes.map((x) => classifier[x.feature]);
  } else if (compound !== undefined) {
    const selectedPartition = compound[0];
    if (selectedPartition === undefined) return new InvalidGlyphError();
    const { operandList, order } = selectedPartition;
    const sequences: { sequence: number[]; taken: number }[] = [];
    for (const operand of operandList) {
      const opearndSequence = recursiveGetSequence(
        form,
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
  } else {
    return new InvalidGlyphError();
  }
};

export const getSequence = (
  form: Form,
  char: string,
  cache?: Map<string, string>,
) => {
  if (char.match(/\d+/)) return char;
  try {
    const recurseResult = recursiveGetSequence(form, char, cache);
    if (recurseResult instanceof Error) {
      console.error("无法获取笔画", char, char.codePointAt(0)!.toString(16));
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
  form: Form,
  glyphCache: Map<string, SVGGlyph> = new Map(),
) {
  const glyph: SVGGlyph = [];
  if (component.source !== undefined) {
    const sourceGlyph = recursiveRenderGlyph(
      component.source,
      form,
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
  form: Form,
  glyphCache: Map<string, SVGGlyph> = new Map(),
) {
  const partition = compound[0];
  if (partition === undefined) {
    return new InvalidGlyphError();
  }
  const glyphs: SVGGlyph[] = [];
  for (const char of partition.operandList) {
    const maybe = recursiveRenderGlyph(char, form, glyphCache);
    if (maybe instanceof InvalidGlyphError) {
      return maybe;
    }
    glyphs.push(maybe);
  }
  return affineMerge(partition.operator, glyphs);
};

export const recursiveRenderGlyph = function (
  char: string,
  form: Form,
  glyphCache: Map<string, SVGGlyph> = new Map(),
): SVGGlyph | InvalidGlyphError {
  const cache = glyphCache.get(char);
  if (cache) return cache;
  const value = form[char];
  if (value === undefined) {
    return new InvalidGlyphError();
  }
  const component = value.component;
  const compound = value.compound;
  if (component !== undefined) {
    const glyph = recursiveRenderComponent(component, form, glyphCache);
    if (!(glyph instanceof InvalidGlyphError)) glyphCache.set(char, glyph);
    return glyph;
  } else if (compound !== undefined) {
    const glyph = recursiveRenderCompound(compound, form, glyphCache);
    if (!(glyph instanceof InvalidGlyphError)) glyphCache.set(char, glyph);
    return glyph;
  } else return new InvalidGlyphError();
};

const computeComponent = (name: string, glyph: SVGGlyph) => {
  const renderedGlyph = renderSVGGlyph(glyph);
  const topology = findTopology(renderedGlyph);
  const cache: ComputedComponent = {
    glyph: renderedGlyph,
    topology,
    name,
  };
  return cache;
};

export const renderComponentForm = (data: MergedData) => {
  const { form } = data;
  const glyphCache = new Map<string, SVGGlyph>();
  const componentForm: Record<string, ComputedComponent> = {};
  const badChars: string[] = [];
  for (const [char, value] of Object.entries(form)) {
    if (value.default_type !== "component") continue;
    try {
      const glyph = recursiveRenderGlyph(char, form, glyphCache);
      if (glyph instanceof Error) {
        badChars.push(char);
        continue;
      }
      componentForm[char] = computeComponent(char, glyph);
    } catch {
      badChars.push(char);
    }
  }
  return [componentForm, badChars] as const;
};

export const renderRootList = (data: MergedData, config: FormConfig) => {
  const { mapping, grouping } = config;
  const glyphCache = new Map<string, SVGGlyph>();
  const roots = [...Object.keys(mapping), ...Object.keys(grouping)].filter(
    (x) => data.form[x] !== undefined,
  );
  const rootList: ComputedComponent[] = [];
  for (const root of roots) {
    try {
      const glyph = recursiveRenderGlyph(root, data.form, glyphCache);
      if (glyph instanceof Error) {
        continue;
      }
      rootList.push(computeComponent(root, glyph));
    } catch {}
  }
  return rootList;
};

export const disassembleComponents = function (
  data: MergedData,
  config: FormConfig,
): [ComponentCache, string[]] {
  const { classifier } = data;
  const [componentForm, badChars] = renderComponentForm(data);
  const rootList = renderRootList(data, config);
  const composables = new Set<string>();
  for (const { compound } of Object.values(data.form)) {
    if (!compound) continue;
    for (const partition of compound) {
      partition.operandList.forEach((x) => composables.add(x));
    }
  }
  const result: ComponentCache = new Map();
  const error: string[] = [];
  Object.entries(componentForm).forEach(([char, cache]) => {
    if (!isValidCJKChar(char) && !composables.has(char)) {
      return;
    }
    const scheme = getComponentScheme(cache, rootList, config, classifier);
    if (scheme instanceof Error) {
      error.push(char);
    } else {
      result.set(char, scheme);
    }
  });
  return [result, badChars.concat(error)];
};
