import {
  MultipleSchemeError,
  type ComputedComponent,
  NoSchemeError,
} from "./component";
import type { Analysis, SieveName } from "./config";
import { binaryToIndices } from "./degenerator";
import type { CurveRelation } from "./topology";
import { isEqual } from "lodash-es";
import { sortTwoNumbers } from "./bezier";
import type { AnalysisConfig } from "./repertoire";

export const defaultSelector: SieveName[] = [
  "结构完整",
  "根少优先",
  "能连不交",
  "能散不连",
  "全符笔顺",
  "取大优先",
];

export type Scheme = number[];

type Comparable = number | number[];

export interface Environment {
  component: ComputedComponent;
  rootMap: Map<number, string>;
  analysis: Analysis;
  primaryRoots: Set<string>;
  secondaryRoots: Set<string>;
}

interface Sieve<T extends Comparable> {
  title: SieveName;
  key: (scheme: Scheme, environment: Environment) => T;
  display?: (data: T) => string;
}

export function isLess<T extends Comparable>(a: T, b: T) {
  if (typeof a === "number" && typeof b === "number") {
    return a < b;
  } else if (Array.isArray(a) && Array.isArray(b)) {
    for (const [i, v] of a.entries()) {
      const u = b[i];
      if (u === undefined) return false;
      if (v < u) return true;
      if (v > u) return false;
    }
    return false;
  }
  return false;
}

export const length: Sieve<number> = {
  title: "根少优先",
  key: (scheme) => scheme.length,
};

const countStrokes: (n: number) => number = (n) =>
  n < 2 ? n : (n & 1) + countStrokes(n >>> 1);

/**
 * 规则：取大优先
 *
 * 让顺序靠前的字根尽量取到更多的笔画
 */
export const bias: Sieve<number[]> = {
  title: "取大优先",
  key: (scheme) => scheme.map(countStrokes).map((x) => -x),
  display: (data: number[]) => "(" + data.map((x) => -x).join(", ") + ")",
};

/**
 * 规则：取小优先
 *
 * 让顺序靠前的字根尽量取到更少的笔画
 */
export const unbias: Sieve<number[]> = {
  title: "取小优先",
  key: (scheme) => scheme.map(countStrokes),
  display: (data: number[]) => "(" + data.join(", ") + ")",
};

/**
 * 规则：全符笔顺
 *
 * 各个字根中笔画的顺序连在一起是否与整个部件的笔顺相同，相同者优先
 * 该规则采集自三码郑码的文档
 *
 * @see https://www.yuque.com/smzm/zhengma/otb32d
 */
export const order: Sieve<number> = {
  title: "全符笔顺",
  key: (scheme, { component }) => {
    const indices = scheme
      .map((x) => binaryToIndices(component.glyph.length)(x))
      .flat();
    const isSorted = indices.slice(1).every((v, i) => indices[i]! < v);
    return Number(!isSorted);
  },
};

/**
 * 规则：连续笔顺
 *
 * 字根是否由部件中连续的几个笔画构成，不符合此特点的字根数量少者优先。该规则采集自宇浩输入法的文档。
 *
 * @see https://zhuyuhao.com/yuhao/docs/learn.html#符合笔顺
 */
export const order2: Sieve<number> = {
  title: "连续笔顺",
  key: (scheme, { component }) => {
    const indices = scheme.map(binaryToIndices(component.glyph.length));
    // 如果一个字根不是由连续的笔画构成，那么称它是不连续的
    const unSorted = indices.filter(
      (x) => x.length - 1 !== x.at(-1)! - x[0]!,
    ).length;
    // 让不连续的字根数量少者优先
    return unSorted;
  },
};

/**
 * 规则：非形近根
 *
 * 尽量少使用被归并到其他字根的字根。该规则采集自三码郑码的文档
 *
 * @see https://www.yuque.com/smzm/zhengma/otb32d
 */
export const similar: Sieve<number> = {
  title: "非形近根",
  key: (scheme, { rootMap, secondaryRoots }) => {
    const roots = scheme.map((x) => rootMap.get(x)!);
    return roots.filter((x) => secondaryRoots.has(x)).length;
  },
};

/**
 * 规则：强字根
 *
 * 尽量多使用特定的一些字根。该规则采集自郑码的文档
 */
export const strong: Sieve<number> = {
  title: "多强字根",
  key: (scheme, { rootMap, analysis }) => {
    const strong = analysis?.strong || [];
    const roots = scheme.map((x) => rootMap.get(x)!);
    return -roots.filter((x) => strong.includes(x)).length;
  },
};

/**
 * 规则：弱字根
 *
 * 尽量避免使用特定的一些字根
 */
export const weak: Sieve<number> = {
  title: "少弱字根",
  key: (scheme, { rootMap, analysis }) => {
    const weak = analysis?.weak || [];
    const roots = scheme.map((x) => rootMap.get(x)!);
    return roots.filter((x) => weak.includes(x)).length;
  },
};

const makeTopologySieve = function (
  relationType: CurveRelation["type"],
  avoidRelationType: CurveRelation["type"][],
  title: SieveName,
): Sieve<number> {
  const key: Sieve<number>["key"] = (scheme, { component }) => {
    const parsedScheme = scheme.map((x) =>
      binaryToIndices(component.glyph.length)(x),
    );
    let totalCrosses = 0;
    for (const [i, bi] of parsedScheme.entries()) {
      for (const [j, bj] of parsedScheme.entries()) {
        if (j >= i) continue;
        let r = false;
        let a = false;
        for (const k of bi) {
          for (const l of bj) {
            const [smaller, larger] = [Math.min(k, l), Math.max(k, l)];
            const relations = component.topology.matrix[larger]![smaller]!;
            r ||= relations.some((v) => v.type === relationType);
            a ||= relations.some((v) => avoidRelationType.includes(v.type));
          }
        }
        if (!a) totalCrosses += Number(r);
      }
    }
    return totalCrosses;
  };
  return { key, title };
};

/**
 * 规则：能连不交
 *
 * 尽量让字根不交叉。该规则采集自五笔
 */
export const crossing = makeTopologySieve("交", [], "能连不交");

/**
 * 规则：能散不连
 *
 * 尽量让字根不相连。该规则采集自五笔
 */
export const attaching = makeTopologySieve("连", ["交"], "能散不连");

/**
 * 规则：同向笔画
 *
 * 尽量让方向相同的笔画包含在同一个字根里。该规则采集自五笔
 */
export const orientation: Sieve<number> = {
  title: "同向笔画",
  key: (scheme, { component }) => {
    const n = component.glyph.length;
    const parsedScheme = scheme.map(binaryToIndices(n));
    let totalCrosses = 0;
    for (const [i, bi] of parsedScheme.entries()) {
      for (const [j, bj] of parsedScheme.entries()) {
        if (j >= i) continue;
        let r = false;
        for (const k of bi) {
          for (const l of bj) {
            const [smaller, larger] = sortTwoNumbers([k, l]);
            const oriented = component.topology.orientedPairs.some((x) =>
              isEqual(x, [larger, smaller]),
            );
            r ||= oriented;
          }
        }
        totalCrosses += Number(r);
      }
    }
    return totalCrosses;
  },
};

/**
 * @param b1 - 以二进制数表示的切片
 * @param b2 - 同上
 * @returns 第一个切片是否包含第二个切片
 */
const contains = (b1: number, b2: number) => (b1 | b2) === b1;

/**
 * 规则：结构完整
 *
 * 避免框类部件被拆散。该规则采集自宇浩输入法的文档
 *
 * @see https://zhuyuhao.com/yuhao/docs/learn.html#结构完整
 */
export const integrity: Sieve<number> = {
  title: "结构完整",
  key: (scheme, { rootMap }) => {
    const priorities = [
      "口",
      "囗",
      "冂",
      "\ue439" /* 见二 */,
      "匚",
      "凵",
      "\ue009" /* 假右角 */,
      "勹",
      "尸",
      "\uE407" /* 央三 */,
    ];
    const shouldHave = [...rootMap]
      .filter(([_, name]) => priorities.includes(name))
      .map(([binary]) => binary);
    const breaks = shouldHave.filter(
      (x) => !scheme.some((binary) => contains(binary, x)),
    ).length;
    return breaks;
  },
};

export const sieveMap = new Map<SieveName, Sieve<number> | Sieve<number[]>>(
  [
    length,
    order,
    order2,
    bias,
    unbias,
    crossing,
    attaching,
    similar,
    orientation,
    integrity,
    strong,
    weak,
  ].map((x) => [x.title, x]),
);

interface SelectResult {
  scheme: Scheme;
  evaluation: Map<SieveName, number | number[]>;
  excluded: boolean;
}

/**
 * 选择最优的拆分方案
 *
 * @param config - 配置
 * @param component - 待拆分部件
 * @param schemeList - 拆分方案列表
 * @param rootMap - 字根映射，从切片的二进制表示到字根名称的映射
 */
export const select = (
  config: AnalysisConfig,
  component: ComputedComponent,
  schemeList: Scheme[],
  rootMap: Map<number, string>,
) => {
  const schemeData = schemeList.map((scheme) => ({
    scheme,
    evaluation: new Map<SieveName, number | number[]>(),
    excluded: false,
  }));
  const environment: Environment = {
    component,
    rootMap,
    ...config,
  };
  for (const sieveName of config.analysis.selector ?? defaultSelector) {
    const sieve = sieveMap.get(sieveName)!;
    let min: number | number[] | undefined;
    for (const data of schemeData) {
      if (data.excluded) continue;
      const value = sieve.key(data.scheme, environment);
      data.evaluation.set(sieve.title, value);
      if (min === undefined) {
        min = value;
      } else if (isLess(value, min)) {
        min = value;
      }
    }
    schemeData.forEach((data) => {
      if (data.evaluation.get(sieve.title) !== min) {
        data.excluded = true;
      }
    });
  }
  // 1. If there are multiple schemes, error
  if (schemeData.filter((x) => !x.excluded).length !== 1) {
    return new MultipleSchemeError();
  }
  // 2. If there is no scheme, error
  const best = schemeData.find((v) => !v.excluded);
  if (best === undefined) return new NoSchemeError();
  // Correct result
  const result: [SelectResult, SelectResult[]] = [best, schemeData];
  return result;
};
