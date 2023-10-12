import { Classifier, Config, RootConfig } from "./config";
import { Glyph } from "./data";
import { binaryToIndices, generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import findTopology, { Relation } from "./topology";

export const makeSequenceFilter = (
  classifier: Classifier,
  sequence: string,
) => {
  return ([, v]: [string, Glyph]) => {
    const fullSequence = v
      .map((s) => s.feature)
      .map((x) => classifier[x])
      .join("");
    return fullSequence.search(sequence) !== -1;
  };
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
  glyph: Glyph;
  topology: Relation[][][];
}

export const getComponentScheme = (
  component: Cache,
  rootData: Cache[],
  config: RootConfig,
  classifier: Classifier,
) => {
  const {
    analysis: { selector },
    mapping,
  } = config;
  if (mapping[component.name])
    return { best: [component.name], map: {}, schemes: [] };
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
  return {
    best: bestScheme.map((n) => rootMap.get(n)!),
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
  best: string[];
  map: Record<string, number[][]>;
  schemes: SchemeWithData[];
}

export interface CompoundResult {
  sequence: string[];
}

export const disassembleComponents = (
  data: Config["data"],
  config: RootConfig,
) => {
  const result = {} as Record<string, ComponentResult>;
  const rootData = [] as Cache[];
  const { components, slices, classifier } = data;
  const { mapping } = config;
  const buildGlyph = (name: string) => {
    const { source, indices } = slices[name];
    const rawglyph = components[source];
    return indices.map((x) => rawglyph[x]);
  };
  for (const rootName in mapping) {
    if (!components[rootName] && !slices[rootName]) {
      // console.log(rootName);
      continue; // 合体字根和单笔画字根无需在这里处理
    }
    const glyph = components[rootName] || buildGlyph(rootName);
    const topology = findTopology(glyph);
    rootData.push({ glyph, topology, name: rootName });
  }
  for (const [name, glyph] of Object.entries(components)) {
    const topology = findTopology(glyph);
    const cache = { name, topology, glyph };
    result[name] = getComponentScheme(cache, rootData, config, classifier);
  }
  return result;
};

export const disassembleCompounds = (
  data: Config["data"],
  config: RootConfig,
  prev: Record<string, ComponentResult>,
) => {
  const { mapping } = config;
  const { compounds } = data;
  const result = {} as Record<string, CompoundResult>;
  const getResult = (s: string) =>
    mapping[s] ? [s] : prev[s] ? prev[s].best : result[s]?.sequence;
  for (const [name, compound] of Object.entries(compounds)) {
    const [c1, c2] = compound.operandList;
    const [r1, r2] = [getResult(c1), getResult(c2)];
    if (r1 !== undefined && r2 !== undefined) {
      result[name] = { sequence: getResult(c1).concat(getResult(c2)) };
    } else {
      // console.log(name, c1, c2);
    }
  }
  return result;
};

export const getRoot = (data: Config["data"], root: RootConfig) => {
  const componentResults = disassembleComponents(data, root);
  const compoundResults = disassembleCompounds(data, root, componentResults);
  const value = {} as Record<string, Record<string, string>>;
  const semy = (l: string[]) =>
    l.length <= 3 ? l : l.slice(0, 2).concat(l[l.length - 1]);
  for (const char in data.characters) {
    let list;
    if (componentResults[char]) {
      const c = componentResults[char];
      list = semy(c.best);
    } else if (compoundResults[char]) {
      const c = compoundResults[char];
      list = semy(c.sequence);
    } else {
      list = ["1"];
    }
    value[char] = {
      "字根 1": list[0],
      "字根 2": list[1],
      "字根 3": list[2],
    };
  }
  return value;
  // write({ index, value });
};
