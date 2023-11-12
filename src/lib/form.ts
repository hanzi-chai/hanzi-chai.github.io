import { Classifier, Config, FormConfig } from "./config";
import {
  BasicComponent,
  Component,
  ComponentGlyph,
  Compound,
  CompoundGlyph,
  Form,
  Glyph,
  Operator,
  SVGGlyph,
} from "./data";
import { binaryToIndices, generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import findTopology, { Relation } from "./topology";
import { Extra } from "./element";

export const recursiveGetSequence = function (
  form: Form,
  classifier: Classifier,
  char: string,
): number[] {
  const { default_type, component, compound } = form[char];
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
            return sourceSequence[x];
          } else {
            return classifier[x.feature];
          }
        });
      }
      return component.strokes.map((x) => classifier[x.feature]);
    case "compound":
      return compound[0].operandList
        .map((s) => recursiveGetSequence(form, classifier, s))
        .flat();
  }
};

const sequenceCache: Record<string, string> = {};

export const getSequence = (
  form: Form,
  classifier: Classifier,
  char: string,
) => {
  if (char.match(/\d+/)) return char;
  let thisSequence: string = sequenceCache[char];
  if (thisSequence !== undefined) return thisSequence;
  thisSequence = recursiveGetSequence(form, classifier, char).join("");
  sequenceCache[char] = thisSequence;
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
  glyph: SVGGlyph;
  topology: Relation[][][];
}

export const getComponentScheme = (
  component: Cache,
  rootData: Cache[],
  config: FormConfig,
  classifier: Classifier,
) => {
  const {
    analysis: { selector },
    mapping,
  } = config;
  if (mapping[component.name])
    return {
      sequence: [component.name],
      all: [component.name],
      map: {},
      schemes: [],
    };
  const rootMap = new Map<number, string>(
    component.glyph.map((stroke, index) => {
      const binary = 1 << (component.glyph.length - 1 - index);
      return [binary, classifier[stroke.feature].toString()];
    }),
  );
  const reverseRootMap = {} as Record<string, number[][]>;
  for (const root of rootData) {
    const binaries = generateSliceBinaries(component, root);
    binaries.forEach((binary) => rootMap.set(binary, root.name));
    if (binaries.length)
      reverseRootMap[root.name] = binaries.map(
        binaryToIndices(component.glyph.length),
      );
  }
  const roots = Array.from(rootMap.keys()).sort((a, b) => a - b);
  const schemeList = generateSchemes(component.glyph.length, roots);
  const [bestScheme, schemeData] = select(selector, component, schemeList);
  const sequence = bestScheme.map((n) => rootMap.get(n)!);
  return {
    sequence,
    all: sequence,
    map: reverseRootMap,
    schemes: [...schemeData.values()].map((x) => ({
      ...x,
      roots: x
        .key!.split(",")
        .map(parseFloat)
        .map((x) => rootMap.get(x)),
    })),
  } as ComponentResult;
};

export interface SchemeWithData {
  key: string;
  roots: string[];
  length: number;
  order: number[];
  crossing: number;
  attaching: number;
  bias: number[];
}

export interface ComponentResult {
  sequence: string[];
  all: string[];
  map: Record<string, number[][]>;
  schemes: SchemeWithData[];
}

interface SequenceTree {
  operator: Operator;
  operandList: (string[] | SequenceTree)[];
}

export interface CompoundResult {
  sequence: string[];
  all: string[] | SequenceTree;
}

export const recursiveRenderGlyph = (
  char: string,
  form: Form,
  glyphCache: Record<string, SVGGlyph> = {},
) => {
  if (char in glyphCache) return glyphCache[char];
  const component = form[char].component!;
  let glyph: SVGGlyph;
  if (component.source !== undefined) {
    const sourceGlyph = recursiveRenderGlyph(component.source, form);
    glyph = component.strokes.map((x) => {
      if (typeof x === "number") return sourceGlyph[x];
      return x;
    });
  } else {
    glyph = component.strokes;
  }
  glyphCache[char] = glyph;
  return glyph;
};

const renderComponentForm = (data: Config["data"], config: FormConfig) => {
  const { form } = data;
  const glyphCache: Record<string, SVGGlyph> = {};
  return Object.fromEntries(
    Object.entries(form)
      .filter(([, g]) => g.default_type === "component")
      .map(([char]) => {
        const glyph = recursiveRenderGlyph(char, form, glyphCache);
        const topology = findTopology(glyph);
        const cache: Cache = { glyph, topology, name: char };
        return [char, cache];
      }),
  );
};

export const disassembleComponents = (
  data: Config["data"],
  config: FormConfig,
) => {
  const { form, classifier } = data;
  const componentCache = renderComponentForm(data, config);
  const { mapping, grouping } = config;
  const roots = [...Object.keys(mapping), ...Object.keys(grouping)];
  const rootData = roots
    .filter((x) => form[x]?.default_type === "component")
    .map((x) => componentCache[x]);
  const result = Object.fromEntries(
    Object.entries(componentCache).map(([char, cache]) => {
      return [char, getComponentScheme(cache, rootData, config, classifier)];
    }),
  );
  return result;
};

const topologicalSort = (form: Form) => {
  const compounds: Record<string, CompoundGlyph> = {};
  for (let i = 0; i != 10; ++i) {
    const thisLevelCompound: Record<string, Glyph> = {};
    for (const [k, glyph] of Object.entries(form)) {
      if (compounds[k]) continue;
      if (glyph.default_type !== "compound") continue;
      if (
        glyph.compound[0].operandList.every(
          (x) =>
            form[x].default_type === "component" || compounds[x] !== undefined,
        )
      ) {
        thisLevelCompound[k] = glyph;
      }
    }
    Object.assign(compounds, thisLevelCompound);
  }
  return compounds;
};

export const disassembleCompounds = (
  data: Config["data"],
  config: FormConfig,
  prev: Record<string, ComponentResult>,
) => {
  const { mapping } = config;
  const compounds = topologicalSort(data.form);
  const result: Record<string, CompoundResult> = {};
  const getResult = (s: string) => (prev[s] ? prev[s] : result[s]);
  for (const [char, glyph] of Object.entries(compounds)) {
    if (mapping[char]) {
      // 复合体本身是一个字根
      result[char] = { sequence: [char], all: [char] };
      continue;
    }
    const { operator, operandList } = glyph.compound[0];
    const results = operandList.map(getResult);
    if (results.every((x) => x !== undefined)) {
      result[char] = {
        sequence: results.map((x) => x.sequence).flat(),
        all: { operator, operandList: results.map((x) => x.all) },
      };
    } else {
      console.error(char, operandList);
    }
  }
  return result;
};

export const getFormCore = (data: Config["data"], config: FormConfig) => {
  const s1 = disassembleComponents(data, config);
  Object.assign(
    s1,
    Object.fromEntries(
      Object.entries(config.analysis.customize).map(([component, sequence]) => {
        const pseudoResult: ComponentResult = {
          sequence: sequence,
          all: sequence,
          map: {},
          schemes: [],
        };
        return [component, pseudoResult];
      }),
    ),
  );
  const s2 = disassembleCompounds(data, config, s1);
  return [s1, s2] as [
    Record<string, ComponentResult>,
    Record<string, ComponentResult>,
  ];
};

const getExtra = function (data: Config["data"], config: FormConfig): Extra {
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
  data: Config["data"],
  config: FormConfig,
) => {
  const extra = getExtra(data, config);
  const [componentResults, compoundResults] = getFormCore(data, config);
  const value = Object.fromEntries(
    list.map((char) => {
      const result = componentResults[char] || compoundResults[char];
      // 这里只处理一种情况，未来可以返回多个拆分
      return result === undefined
        ? [char, []]
        : [char, [result] as ComponentResult[] | CompoundResult[]];
    }),
  );
  return [value, extra] as const;
};
