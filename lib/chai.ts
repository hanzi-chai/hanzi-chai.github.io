import { Config, RootConfig } from "./config";
import { Wen, Glyph, Zi, Compound } from "./data";
import { generateSliceBinaries } from "./degenerator";
import select, { sieveMap } from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import findTopology, { Relation } from "./topology";

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

const generateSchemes = (component: Glyph, rootMap: Map<number, string>) => {
  const totFragmentBins = Array.from(rootMap.keys()).sort((a, b) => a - b);
  const schemeList = [] as number[][];
  const holoBin = (1 << component.length) - 1;
  const combineNext = (curBin: number, curScheme: number[]) => {
    const restBin = holoBin - curBin;
    const restBin1st = 1 << (restBin.toString(2).length - 1);
    const start = bisectLeft(totFragmentBins, restBin1st);
    const end = bisectRight(totFragmentBins, restBin);
    for (const binary of totFragmentBins.slice(start, end)) {
      if ((curBin & binary) !== 0) continue;
      const newBin = curBin + binary;
      if (newBin === holoBin) {
        schemeList.push(curScheme.concat(binary));
      } else {
        combineNext(newBin, curScheme.concat(binary));
      }
    }
  };
  combineNext(0, []);
  return schemeList;
};

export interface ComponentData {
  name: string;
  glyph: Glyph;
  topology: Relation[][][];
}

const getComponentScheme = (
  name: string,
  componentGlyph: Glyph,
  rootData: Map<string, { glyph: Glyph; topology: Relation[][][] }>,
  config: RootConfig,
) => {
  const {
    analysis: { classifier, selector },
    mapping,
    aliaser,
  } = config;
  if (mapping[name]) return { best: [name], map: [], schemes: [] };
  if (componentGlyph.length === 1)
    return {
      best: [classifier[componentGlyph[0].feature].toString()],
      map: [],
      schemes: [],
    };
  const sieveList = selector.map((s) => sieveMap.get(s)!);
  const rootMap = new Map<number, string>();
  for (const [index, stroke] of componentGlyph.entries()) {
    const binary = 1 << (componentGlyph.length - 1 - index);
    rootMap.set(binary, classifier[stroke.feature].toString());
  }
  const componentTopology = findTopology(componentGlyph);
  const component: ComponentData = {
    name,
    glyph: componentGlyph,
    topology: componentTopology,
  };
  for (const [rootName, value] of rootData.entries()) {
    const root: ComponentData = { name: rootName, ...value };
    const binaries = generateSliceBinaries(component, root);
    binaries.forEach((v) => rootMap.set(v, rootName));
  }
  const schemeList = generateSchemes(componentGlyph, rootMap);
  const componentData: ComponentData = {
    name,
    glyph: componentGlyph,
    topology: componentTopology,
  };
  return select(sieveList, componentData, schemeList, rootMap);
};

const componentDisassembly = (wen: Wen, config: RootConfig) => {
  const result = {} as Record<string, ComponentResult>;
  const rootData = new Map<
    string,
    { glyph: Glyph; topology: Relation[][][] }
  >();
  const mapping = config.mapping;
  for (const rootName of Object.keys(mapping)) {
    if (!wen[rootName]) continue; // 暂不处理切片字根和合体字根
    const glyph = wen[rootName].shape[0].glyph;
    const topology = findTopology(glyph);
    rootData.set(rootName, { glyph, topology });
  }
  for (const [name, component] of Object.entries(wen)) {
    const glyph = component.shape[0].glyph;
    result[name] = getComponentScheme(name, glyph, rootData, config);
  }
  return result;
};

export const compoundDisassembly = (
  zi: Zi,
  config: RootConfig,
  prev: Record<string, ComponentResult>,
) => {
  const result = {} as Record<string, CompoundResult>;
  const getResult = (s: string) =>
    prev[s] ? prev[s].best : result[s]?.sequence;
  for (const [name, compound] of Object.entries(zi)) {
    const [c1, c2] = compound.operandList;
    const [r1, r2] = [getResult(c1), getResult(c2)];
    if (r1 !== undefined && r2 !== undefined) {
      result[name] = { sequence: getResult(c1).concat(getResult(c2)) };
    } else {
      console.log(name, c1, c2);
    }
  }
  return result;
};

export default componentDisassembly;
