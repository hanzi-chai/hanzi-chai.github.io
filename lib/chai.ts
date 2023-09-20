import { Config, sieveMap } from "./config";
import { Wen, Glyph } from "./data";
import { generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import { reverseClassifier } from "./utils";
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
  config: Config,
) => {
  if (config.roots.includes(name))
    return { best: [name], map: [], schemes: [] };
  const reverse = reverseClassifier(config.classifier);
  if (componentGlyph.length === 1)
    return {
      best: [reverse.get(componentGlyph[0].feature)!],
      map: [],
      schemes: [],
    };
  const sieveList = config.selector.map((s) => sieveMap.get(s)!);
  const rootMap = new Map<number, string>();
  for (const [index, stroke] of componentGlyph.entries()) {
    const binary = 1 << (componentGlyph.length - 1 - index);
    rootMap.set(binary, reverse.get(stroke.feature)!);
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

const chai = (wen: Wen, config: Config) => {
  const result = {} as Record<string, ComponentResult>;
  const rootData = new Map<
    string,
    { glyph: Glyph; topology: Relation[][][] }
  >();
  for (const rootName of config.roots) {
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

export default chai;
