import type { FormConfig, MergedData, SieveName } from "./config";
import type { Block, CompoundGlyph, Form, Operator, SVGGlyph } from "./data";
import { binaryToIndices, generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import type { RenderedGlyph, StrokeRelation } from "./topology";
import findTopology, { renderSVGGlyph } from "./topology";
import type { Extra } from "./element";
import type { Classifier } from "./classifier";

export const recursiveGetSequence = function (
  form: Form,
  classifier: Classifier,
  char: string,
): number[] {
  const glyph = form[char];
  if (!glyph)
    throw new Error(
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
        return component.strokes.map((x) => {
          if (typeof x === "number") {
            return sourceSequence[x]!;
          } else {
            return classifier[x.feature];
          }
        });
      }
      return component.strokes.map((x) => classifier[x.feature]);
    case "compound":
      return compound[0]!.operandList
        .map((s) => recursiveGetSequence(form, classifier, s))
        .flat();
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
  try {
    thisSequence = recursiveGetSequence(form, classifier, char).join("");
  } catch (e) {
    console.log(char, char.codePointAt(0)!);
    thisSequence = "";
  }
  sequenceCache.set(char, thisSequence);
  return thisSequence;
};

export const generateSchemes = (n: number, roots: number[]) => {
  const schemeList = [] as number[][];
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

export interface Cache {
  name: string;
  glyph: RenderedGlyph;
  topology: StrokeRelation[][];
}

export const buildCache = function (glyph: SVGGlyph, name = ""): Cache {
  const renderedGlyph = renderSVGGlyph(glyph);
  return { name, glyph: renderedGlyph, topology: findTopology(renderedGlyph) };
};

export const getComponentScheme = function (
  component: Cache,
  rootData: Cache[],
  config: FormConfig,
  classifier: Classifier,
): ComponentResult {
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
  const [bestScheme, schemeData] = select(
    config,
    component,
    schemeList,
    rootMap,
  );
  const sequence = bestScheme.map((n) => rootMap.get(n)!);
  const detail = bestScheme.map((n) => ({ name: rootMap.get(n)!, binary: n }));
  return {
    sequence,
    detail: detail,
    strokes: component.glyph.length,
    map: rootMap,
    schemes: schemeData.map((v, i) => {
      return {
        sequence: schemeList[i]!.map((x) => rootMap.get(x)!),
        data: v,
      };
    }),
  };
};

export type ComponentResult = ComponentRootResult | ComponentRegularResult;

export interface SchemeWithData {
  sequence: string[];
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
export type CompoundCache = Map<string, CompoundResult>;

type PartitionResult = ComponentResult | CompoundResult;

export type CompoundResult = CompoundRootResult | CompoundRegularResult;

// 两个以上字根
interface CompoundRegularResult {
  sequence: string[];
  detail: {
    operator: Operator;
    partitionResults: PartitionResult[];
  };
}

// 本身是字根字，无拆分细节
interface CompoundRootResult {
  sequence: [string];
}

export const recursiveRenderGlyph = (
  char: string,
  form: Form,
  glyphCache: Map<string, SVGGlyph> = new Map(),
) => {
  const component = form[char]?.component;
  if (component === undefined) {
    throw new Error("char is not a component");
  }
  const cache = glyphCache.get(char);
  if (cache) return cache;
  let glyph: SVGGlyph;
  if (component.source !== undefined) {
    const sourceGlyph = recursiveRenderGlyph(component.source, form);
    glyph = component.strokes.map((x) => {
      if (typeof x === "number") return sourceGlyph[x]!;
      return x;
    });
  } else {
    glyph = component.strokes;
  }
  glyphCache.set(char, glyph);
  return glyph;
};

export const renderComponentForm = (data: MergedData) => {
  const { form } = data;
  const glyphCache = new Map<string, SVGGlyph>();
  return new Map(
    Object.entries(form)
      .filter(([, g]) => g.default_type === "component")
      .map(([char]) => {
        const glyph = recursiveRenderGlyph(char, form, glyphCache);
        const renderedGlyph = renderSVGGlyph(glyph);
        const topology = findTopology(renderedGlyph);
        const cache: Cache = { glyph: renderedGlyph, topology, name: char };
        return [char, cache];
      }),
  );
};

export const renderComponentGlyphs = (data: MergedData) => {
  const { form } = data;
  const glyphCache = new Map<string, SVGGlyph>();
  return Object.fromEntries(
    Object.entries(form)
      .filter(([, g]) => g.default_type === "component")
      .map(([char]) => {
        const glyph = recursiveRenderGlyph(char, form, glyphCache);
        return [char, glyph];
      }),
  );
};

export const disassembleComponents = function (
  data: MergedData,
  config: FormConfig,
): ComponentCache {
  const { classifier } = data;
  const componentCache = renderComponentForm(data);
  const { mapping, grouping } = config;
  const roots = new Set([...Object.keys(mapping), ...Object.keys(grouping)]);
  const rootData = [...componentCache]
    .filter(([x]) => {
      return roots.has(x);
    })
    .map(([, c]) => c);
  const result = new Map(
    [...componentCache].map(([char, cache]) => {
      return [char, getComponentScheme(cache, rootData, config, classifier)];
    }),
  );
  return result;
};

const topologicalSort = (form: Form) => {
  let compounds = new Map<string, CompoundGlyph>();
  for (let i = 0; i !== 10; ++i) {
    const thisLevelCompound = new Map<string, CompoundGlyph>();
    for (const [k, glyph] of Object.entries(form)) {
      if (compounds.get(k)) continue;
      if (glyph.default_type !== "compound") continue;
      if (
        glyph.compound[0]!.operandList.every(
          (x) =>
            form[x]!.default_type === "component" ||
            compounds.get(x) !== undefined,
        )
      ) {
        thisLevelCompound.set(k, glyph);
      }
    }
    compounds = new Map([...compounds, ...thisLevelCompound]);
  }
  return compounds;
};

const assembleSequence = (
  partitionResults: PartitionResult[],
  order: Block[],
) => {
  const sequence: string[] = [];
  const subsequences = partitionResults.map((x) => ({
    rest: x.sequence,
    taken: 0,
  }));
  for (const { index, strokes } of order) {
    const data = subsequences[index]!;
    if (strokes === 0) {
      sequence.push(...data.rest);
      data.rest = [];
    } else {
      const partitionResult = partitionResults[index]!;
      if ("schemes" in partitionResult) {
        const { detail, strokes: totalStrokes } = partitionResult;
        const upperBound = 1 << (totalStrokes - data.taken);
        const lowerBound = 1 << (totalStrokes - data.taken - strokes);
        const toTake = detail.filter(
          ({ binary }) => binary >= lowerBound && binary < upperBound,
        ).length;
        sequence.push(...data.rest.slice(0, toTake));
        data.rest = data.rest.slice(toTake);
      } else {
        sequence.push(...data.rest);
        data.rest = [];
      }
    }
  }
  return sequence;
};

export const disassembleCompounds = (
  data: MergedData,
  config: FormConfig,
  componentCache: ComponentCache,
) => {
  const { mapping } = config;
  const compounds = topologicalSort(data.form);
  const compoundCache: CompoundCache = new Map();
  const getResult = function (s: string): PartitionResult | undefined {
    return componentCache.get(s) || compoundCache.get(s);
  };
  for (const [char, glyph] of compounds.entries()) {
    if (mapping[char]) {
      // 复合体本身是一个字根
      compoundCache.set(char, { sequence: [char] });
      continue;
    }
    const { operator, operandList, order } = glyph.compound[0]!;
    const rawPartitionResults = operandList.map(getResult);
    if (rawPartitionResults.every((x) => x !== undefined)) {
      const partitionResults = rawPartitionResults as PartitionResult[];
      const sequence =
        order === undefined
          ? partitionResults.map((x) => x.sequence).flat()
          : assembleSequence(partitionResults, order);
      compoundCache.set(char, {
        sequence,
        detail: {
          operator,
          partitionResults,
        },
      });
    } else {
      console.error(char, operandList);
    }
  }
  return compoundCache;
};

export const getFormCore = (data: MergedData, config: FormConfig) => {
  const componentCache = disassembleComponents(data, config);
  const customizations: ComponentCache = new Map(
    Object.entries(config.analysis.customize).map(([component, sequence]) => {
      const pseudoResult: ComponentResult = { sequence: sequence };
      return [component, pseudoResult] as const;
    }),
  );
  const customized = new Map([...componentCache, ...customizations]);
  const compoundCache = disassembleCompounds(data, config, customized);
  return [customized, compoundCache] as const;
};

const getExtra = function (data: MergedData, config: FormConfig): Extra {
  const { form, classifier } = data;
  const { mapping, grouping } = config;
  const roots = Object.keys(mapping).concat(Object.keys(grouping));
  const findSequence = (x: string) => {
    if (form[x] === undefined) {
      // 单笔画
      return [Number(x)];
    }
    return recursiveGetSequence(form, classifier, x);
  };
  const rootSequence = Object.fromEntries(
    roots.map((x) => [x, findSequence(x)]),
  );
  return {
    rootSequence,
  };
};

export const getForm = (
  list: string[],
  data: MergedData,
  config: FormConfig,
) => {
  const extra = getExtra(data, config);
  const [componentResults, compoundResults] = getFormCore(data, config);
  const value = new Map(
    list.map((char) => {
      const result = componentResults.get(char) || compoundResults.get(char);
      // 这里只处理一种情况，未来可以返回多个拆分
      return result === undefined ? [char, []] : [char, [result]];
    }),
  );
  return [value, extra] as const;
};
