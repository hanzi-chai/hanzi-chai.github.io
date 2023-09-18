import { Config, sieveMap } from "./config";
import { Database, Glyph } from "./data";
import { generateSliceBinaries } from "./degenerator";
import select from "./selector";
import { bisectLeft, bisectRight } from "d3-array";
import { reverseClassifier } from "./utils";

export interface SchemeWithData {
  key: string;
  roots: string[];
  order: number[];
  crossing: number;
  attaching: number;
  bias: number[];
}

export interface ComponentResult {
  best: string[];
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

const getComponentScheme = (
  name: string,
  component: Glyph,
  data: Database,
  config: Config
) => {
  if (config.roots.includes(name)) return { best: [name], schemes: [] };
  const reverse = reverseClassifier(config.classifier);
  if (component.length === 1) return { best: [reverse.get(component[0].feature)!], schemes: [] };
  const sieveList = config.selector.map((s) => sieveMap.get(s)!);
  const rootMap = new Map<number, string>();
  for (const [index, stroke] of component.entries()) {
    const binary = 1 << (component.length - 1 - index);
    rootMap.set(binary, reverse.get(stroke.feature)!);
  }
  for (const rootName of config.roots) {
    if (!data[rootName]) continue; // 暂不处理切片字根和合体字根
    const root = data[rootName].shape[0].glyph;
    const binaries = generateSliceBinaries(component, root);
    binaries.forEach((v) => rootMap.set(v, rootName));
  }
  const schemeList = generateSchemes(component, rootMap);
  return select(sieveList, name, component, schemeList, rootMap);
};

const chai = (data: Database, config: Config) => {
  const result = {} as Record<string, ComponentResult>;
  for (const [name, component] of Object.entries(data)) {
    const glyph = component.shape[0].glyph;
    result[name] = getComponentScheme(name, glyph, data, config);
  }
  return result;
};

export default chai;
