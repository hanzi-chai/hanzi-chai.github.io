import { Config, RootConfig } from "./config";
import { Wen, Glyph, Zi, Compound } from "./data";
import { binaryToIndices, generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import findTopology, { Relation } from "./topology";

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
) => {
  const {
    analysis: { classifier, selector },
    mapping,
  } = config;
  if (mapping[component.name])
    return { best: [component.name], map: [], schemes: [] };
  const rootMap = new Map<number, string>(
    component.glyph.map((stroke, index) => {
      const binary = 1 << (component.glyph.length - 1 - index);
      return [binary, classifier[stroke.feature].toString()];
    }),
  );
  for (const root of rootData) {
    generateSliceBinaries(component, root).forEach((binary) =>
      rootMap.set(binary, root.name),
    );
  }
  const roots = Array.from(rootMap.keys()).sort((a, b) => a - b);
  const schemeList = generateSchemes(component.glyph.length, roots);
  const parsedRootMap = [...rootMap.entries()].map(
    ([k, v]) =>
      [binaryToIndices(component.glyph.length)(k), v] as [number[], string],
  );
  const [bestScheme, schemeData] = select(selector, component, schemeList);
  return {
    best: bestScheme.map((n) => rootMap.get(n)!),
    map: parsedRootMap,
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
  map: [number[], string][];
  schemes: SchemeWithData[];
}

export interface CompoundResult {
  sequence: string[];
}

export const disassembleComponents = (wen: Wen, config: RootConfig) => {
  const result = {} as Record<string, ComponentResult>;
  const rootData = [] as Cache[];
  const { mapping, aliaser } = config;
  const buildGlyph = (name: string) => {
    const { source, indices } = aliaser[name];
    const rawglyph = wen[source];
    return indices.map((x) => rawglyph[x]);
  };
  for (const rootName in mapping) {
    if (!wen[rootName] && !aliaser[rootName]) {
      // console.log(rootName);
      continue; // 合体字根和单笔画字根无需在这里处理
    }
    const glyph = wen[rootName] || buildGlyph(rootName);
    const topology = findTopology(glyph);
    rootData.push({ glyph, topology, name: rootName });
  }
  for (const [name, glyph] of Object.entries(wen)) {
    const topology = findTopology(glyph);
    const cache = { name, topology, glyph };
    result[name] = getComponentScheme(cache, rootData, config);
  }
  return result;
};

export const disassembleCompounds = (
  zi: Zi,
  config: RootConfig,
  prev: Record<string, ComponentResult>,
) => {
  const { mapping } = config;
  const result = {} as Record<string, CompoundResult>;
  const getResult = (s: string) =>
    mapping[s] ? [s] : prev[s] ? prev[s].best : result[s]?.sequence;
  for (const [name, compound] of Object.entries(zi)) {
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
