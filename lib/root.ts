import {
  Classifier,
  Config,
  ElementCache,
  ElementResult,
  RootConfig,
} from "./config";
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

export const makeSequenceFilter2 = (
  classifier: Classifier,
  sequence: string,
) => {
  return (v: Glyph) => {
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

const getRootData = (data: Config["data"], config: RootConfig) => {
  const rootData = [] as Cache[];
  const { components, slices } = data;
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
  return rootData;
};

export const disassembleComponents = (
  data: Config["data"],
  config: RootConfig,
  rootData?: Cache[],
) => {
  const { components, classifier } = data;
  if (!rootData) rootData = getRootData(data, config);
  const result = {} as Record<string, ComponentResult>;
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

interface Extra {
  rootData: Record<string, { glyph: Glyph }>;
}

export interface ElementNode {
  name: string;
  fn: (rl: string[], data: Config["data"], extra: Extra) => string;
  children: ElementNode[];
}

function getindex<T>(a: T[], i: number) {
  return i >= 0 ? a[i + 1] : a[a.length + i];
}

const forwardStrokes: (i: number) => (j: number) => ElementNode =
  (i) => (j) => ({
    name: `根 ${i} 笔 ${j}`,
    fn: (rl, data, extra) => {
      const root = getindex(rl, i);
      const { glyph } = extra?.rootData[root];
      const { feature } = getindex(glyph, j);
      return data.classifier[feature].toString();
    },
    children: [],
  });

const forwardRoots: (i: number) => ElementNode = (i) => ({
  name: `根 ${i}`,
  fn: (rl) => getindex(rl, i),
  children: [
    ...[1, 2, 3].map(forwardStrokes(i)),
    ...[-1, -2, -3].map(forwardStrokes(i)),
  ],
});

export const provideElements: ElementNode[] = [
  ...[1, 2, 3, 4].map(forwardRoots),
  ...[-1, -2, -3, -4].map(forwardRoots),
];

type ElementLookup = Record<string, ElementNode["fn"]>;

function flatten(en: ElementNode): ElementLookup {
  return Object.assign(
    { [en.name]: en.fn },
    ...en.children.map(flatten),
  ) as ElementLookup;
}

const elementLookup = Object.assign({}, ...provideElements.map(flatten));

const getRecord = (
  nodes: string[],
  rootlist: string[],
  data: Config["data"],
  extra: Extra,
) => {
  return Object.fromEntries(
    nodes.map((name) => {
      return [name, elementLookup[name](rootlist, data, extra)];
    }),
  );
};

export const getRoot = (
  list: string[],
  data: Config["data"],
  config: RootConfig,
) => {
  const rootData = getRootData(data, config);
  const rootLookup = Object.fromEntries(
    rootData.map(({ name, glyph }) => [name, { glyph }]),
  );
  const componentResults = disassembleComponents(data, config, rootData);
  const compoundResults = disassembleCompounds(data, config, componentResults);
  const value = {} as ElementCache;
  for (const char of list) {
    let rootlist: string[] | undefined;
    if (componentResults[char]) {
      const c = componentResults[char];
      rootlist = c.best;
    } else if (compoundResults[char]) {
      const c = compoundResults[char];
      rootlist = c.sequence;
    } else {
      rootlist = undefined;
    }
    value[char] = rootlist
      ? [getRecord(config.nodes, rootlist, data, { rootData: rootLookup })]
      : [];
  }
  return value;
};
