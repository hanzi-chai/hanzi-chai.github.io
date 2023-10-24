import { Classifier, Config, FormConfig, TotalResult } from "./config";
import { Component, Compound, Form, Glyph, Operator } from "./data";
import { binaryToIndices, generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import findTopology, { Relation } from "./topology";

export const makeSequenceFilter = (
  classifier: Classifier,
  sequence: string,
) => {
  return ([, v]: [string, Glyph]) => {
    const fullSequence =
      v.component &&
      v.component
        .map((s) => s.feature)
        .map((x) => classifier[x])
        .join("");
    if (!fullSequence) return false;
    return fullSequence.search(sequence) !== -1;
  };
};

export const recursiveGetSequence = function (
  form: Form,
  classifier: Classifier,
  char: string,
): number[] {
  const glyph = form[char];
  if (glyph.default_type === 0) {
    return glyph.component.map((s) => classifier[s.feature]);
  } else {
    return glyph
      .compound!.operandList.map((s) =>
        recursiveGetSequence(form, classifier, String.fromCodePoint(s)),
      )
      .flat();
  }
};

export const getSequence = (
  form: Form,
  classifier: Classifier,
  char: string,
) => {
  let thisSequence: string;
  const glyph = form[char];
  switch (glyph.default_type) {
    case 0:
    case 1:
      thisSequence = recursiveGetSequence(form, classifier, char).join("");
      break;
    case 2:
      const sourceSequence = recursiveGetSequence(
        form,
        classifier,
        String.fromCodePoint(glyph.slice.source),
      );
      thisSequence = glyph.slice.indices.map((x) => sourceSequence[x]).join("");
      break;
  }
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
  glyph: Component;
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
  operandList: [string[] | SequenceTree, string[] | SequenceTree];
}

export interface CompoundResult {
  sequence: string[];
  all: string[] | SequenceTree;
}

const getRootData = (data: Config["data"], config: FormConfig) => {
  const rootData = [] as Cache[];
  const { form } = data;
  const { mapping } = config;
  const buildGlyph = (name: string) => {
    const { source, indices } = form[name].slice!;
    const rawglyph = form[source].component!;
    return indices.map((x) => rawglyph[x]);
  };
  for (const name in mapping) {
    if (!form[name].component && !form[name].slice) {
      // console.log(rootName);
      continue; // 合体字根和单笔画字根无需在这里处理
    }
    const glyph = form[name].component || buildGlyph(name);
    const topology = findTopology(glyph);
    rootData.push({ glyph, topology, name: name });
  }
  return rootData;
};

export const disassembleComponents = (
  data: Config["data"],
  config: FormConfig,
  rootData?: Cache[],
) => {
  const { form, classifier } = data;
  if (!rootData) rootData = getRootData(data, config);
  const result = {} as Record<string, ComponentResult>;
  for (const [name, glyph] of Object.entries(form).filter(
    ([, g]) => g.default_type === 0,
  )) {
    const topology = findTopology(glyph.component!);
    const cache = { name, topology, glyph: glyph.component! };
    result[name] = getComponentScheme(cache, rootData, config, classifier);
  }
  return result;
};

const topologicalSort = (form: Form) => {
  const compound: Record<string, Compound> = {};
  return compound;
};

export const disassembleCompounds = (
  data: Config["data"],
  config: FormConfig,
  prev: Record<string, ComponentResult>,
) => {
  const { mapping } = config;
  const compounds = topologicalSort(data.form);
  const result = {} as Record<string, CompoundResult>;
  const getResult = (s: string) => (prev[s] ? prev[s] : result[s]);
  for (const [name, compound] of Object.entries(compounds)) {
    if (mapping[name]) {
      // 复合体本身是一个字根
      result[name] = { sequence: [name], all: [name] };
      continue;
    }
    const {
      operator,
      operandList: [c1, c2],
    } = compound;
    const [r1, r2] = [
      getResult(String.fromCodePoint(c1)),
      getResult(String.fromCodePoint(c2)),
    ];
    if (r1 !== undefined && r2 !== undefined) {
      result[name] = {
        sequence: r1.sequence.concat(r2.sequence),
        all: { operator, operandList: [r1.all, r2.all] },
      };
    } else {
      console.error(name, c1, c2);
    }
  }
  return result;
};

export const getForm = (
  list: string[],
  data: Config["data"],
  config: FormConfig,
) => {
  const rootData = getRootData(data, config);
  const rootLookup = Object.fromEntries(
    rootData.map(({ name, glyph }) => [name, { glyph }]),
  );
  const componentResults = disassembleComponents(data, config, rootData);
  const compoundResults = disassembleCompounds(data, config, componentResults);
  const value = Object.fromEntries(
    list.map((char) => {
      const result = componentResults[char] || compoundResults[char];
      // 这里只处理一种情况，未来可以返回多个拆分
      return result === undefined
        ? [char, []]
        : [char, [result] as ComponentResult[] | CompoundResult[]];
    }),
  );
  return [value, { rootData: rootLookup }] as const;
};
