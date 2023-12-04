import type { FormConfig, MergedData, SieveName } from "./config";
import type { Form, SVGGlyph } from "./data";
import { generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import type { RenderedGlyph, Topology } from "./topology";
import findTopology, { renderSVGGlyph } from "./topology";
import type { Classifier } from "./classifier";

class UnknownCharError extends Error {}
class InvalidGlyphError extends Error {}

export const recursiveGetSequence = function (
  form: Form,
  classifier: Classifier,
  char: string,
): number[] | UnknownCharError | InvalidGlyphError {
  const glyph = form[char];
  if (!glyph)
    return new UnknownCharError(
      `Unknown char: ${char}, ${char
        .codePointAt(0)!
        .toString(16)}, ${char.codePointAt(0)!}`,
    );
  const { default_type, component, compound } = glyph;
  switch (default_type) {
    case "component":
      if (component.source !== undefined) {
        const sourceSequence = recursiveGetSequence(
          form,
          classifier,
          component.source,
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
    case "compound":
      const selectedPartition = compound[0];
      if (selectedPartition === undefined) return new InvalidGlyphError();
      const { operandList, order } = selectedPartition;
      const sequences: { sequence: number[]; taken: number }[] = [];
      for (const operand of operandList) {
        const opearndSequence = recursiveGetSequence(form, classifier, operand);
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

const sequenceCache = new Map<string, string>();

export const getSequence = (
  form: Form,
  classifier: Classifier,
  char: string,
) => {
  if (char.match(/\d+/)) return char;
  let thisSequence = sequenceCache.get(char);
  if (thisSequence !== undefined) return thisSequence;
  const recurseResult = recursiveGetSequence(form, classifier, char);
  if (recurseResult instanceof Error) return "";
  thisSequence = recurseResult.join("");
  sequenceCache.set(char, thisSequence);
  return thisSequence;
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
    return new NoSchemeError("No scheme available for component");
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

export const recursiveRenderGlyph = function (
  char: string,
  form: Form,
  glyphCache: Map<string, SVGGlyph> = new Map(),
): SVGGlyph | InvalidGlyphError {
  const component = form[char]?.component;
  if (component === undefined) {
    console.log(char, char.codePointAt(0)!.toString(16));
    throw new Error("char is not a component");
  }
  const cache = glyphCache.get(char);
  if (cache) return cache;
  const glyph: SVGGlyph = [];
  if (component.source !== undefined) {
    const sourceGlyph = recursiveRenderGlyph(component.source, form);
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
  glyphCache.set(char, glyph);
  return glyph;
};

export const renderComponentForm = (data: MergedData) => {
  const { form } = data;
  const glyphCache = new Map<string, SVGGlyph>();
  return Object.fromEntries(
    Object.entries(form)
      .filter(([, g]) => g.default_type === "component")
      .map(([char]) => {
        const glyph = recursiveRenderGlyph(char, form, glyphCache) as SVGGlyph;
        const renderedGlyph = renderSVGGlyph(glyph);
        const topology = findTopology(renderedGlyph);
        const cache: ComputedComponent = {
          glyph: renderedGlyph,
          topology,
          name: char,
        };
        return [char, cache];
      }),
  );
};

export const disassembleComponents = function (
  data: MergedData,
  config: FormConfig,
): [ComponentCache, string[]] {
  const { classifier } = data;
  const componentForm = renderComponentForm(data);
  const { mapping, grouping } = config;
  const roots = new Set([...Object.keys(mapping), ...Object.keys(grouping)]);
  const rootData = Object.entries(componentForm)
    .filter(([x]) => {
      return roots.has(x);
    })
    .map(([, c]) => c);
  const result: ComponentCache = new Map();
  const error: string[] = [];
  Object.entries(componentForm).forEach(([char, cache]) => {
    const scheme = getComponentScheme(cache, rootData, config, classifier);
    if (scheme instanceof Error) {
      error.push(char);
    } else {
      result.set(char, scheme);
    }
  });
  return [result, error];
};
