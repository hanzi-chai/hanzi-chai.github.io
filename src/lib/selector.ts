import type { Cache } from "./form";
import type { FormConfig, Selector, SieveName } from "./config";
import { binaryToIndices } from "./degenerator";
import type { CurveRelation } from "./topology";

type Scheme = number[];

type Comparable = number | number[];

interface Sieve<T extends Comparable> {
  title: SieveName;
  key: (
    scheme: Scheme,
    component: Cache,
    config: FormConfig,
    rootMap: Map<number, string>,
  ) => T;
  display?: (data: T) => string;
}

function isLess<T extends Comparable>(a: T, b: T) {
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
 * 让顺序靠前的字根尽量取到更多的笔画
 */
export const bias: Sieve<number[]> = {
  title: "取大优先",
  key: (scheme) => scheme.map(countStrokes).map((x) => -x),
  display: (data: number[]) => "(" + data.map((x) => -x).join(", ") + ")",
};

/**
 * 规则：全符笔顺
 * 各个字根中笔画的顺序连在一起是否与整个部件的笔顺相同，相同者优先
 * 该规则采集自三码郑码的文档
 * 参考：https://www.yuque.com/smzm/zhengma/otb32d
 */
export const order: Sieve<number> = {
  title: "全符笔顺",
  key: (scheme, component) => {
    const indices = scheme
      .map((x) => binaryToIndices(component.glyph.length)(x))
      .flat();
    const isSorted = indices.slice(1).every((v, i) => indices[i]! < v);
    return Number(!isSorted);
  },
};

/**
 * 规则：连续笔顺
 * 字根是否由部件中连续的几个笔画构成，不符合此特点的字根数量少者优先
 * 该规则采集自宇浩输入法的文档
 * 参考：https://zhuyuhao.com/yuhao/docs/learn.html#符合笔顺
 */
export const order2: Sieve<number> = {
  title: "连续笔顺",
  key: (scheme, component) => {
    const indices = scheme.map((x) =>
      binaryToIndices(component.glyph.length)(x),
    );
    const unSorted = indices.filter(
      (x) => x.length - 1 === x.at(-1)! - x[0]!,
    ).length;
    return unSorted;
  },
};

/**
 * 规则：非形近根
 * 尽量少使用被归并到其他字根的字根
 * 该规则采集自三码郑码的文档
 * 参考：https://www.yuque.com/smzm/zhengma/otb32d
 */
export const similar: Sieve<number> = {
  title: "非形近根",
  key: (scheme, _, config, rootMap) => {
    const roots = scheme.map((x) => rootMap.get(x)!);
    return roots.filter((x) => config.grouping[x] !== undefined).length;
  },
};

const makeTopologySieve = function (
  relationType: CurveRelation["type"],
  avoidRelationType: CurveRelation["type"][],
  title: SieveName,
): Sieve<number> {
  const key: Sieve<number>["key"] = (scheme, component) => {
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
            const relations = component.topology[larger]![smaller]!;
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

export const crossing = makeTopologySieve("交", [], "能连不交");

export const attaching = makeTopologySieve("连", ["交"], "能散不连");

export const orientation: Sieve<number> = {
  title: "同向笔画",
  key: (scheme, component) => {
    const parsedScheme = scheme.map((x) =>
      binaryToIndices(component.glyph.length)(x),
    );
    let totalCrosses = 0;
    for (const [i, bi] of parsedScheme.entries()) {
      for (const [j, bj] of parsedScheme.entries()) {
        if (j >= i) continue;
        let r = false;
        for (const k of bi) {
          for (const l of bj) {
            const [smaller, larger] = [Math.min(k, l), Math.max(k, l)];
            const relations = component.topology[larger]![smaller]!;
            const isOverlapping = relations.some(
              (v) => v.type === "平行" && v.mainAxis === 0,
            );
            r ||= isOverlapping;
          }
        }
        totalCrosses += +r;
      }
    }
    return totalCrosses;
  },
};

export const sieveMap = new Map<SieveName, Sieve<number> | Sieve<number[]>>(
  [length, order, order2, bias, crossing, attaching, similar, orientation].map(
    (x) => [x.title, x],
  ),
);

const select = (
  config: FormConfig,
  component: Cache,
  schemeList: Scheme[],
  rootMap: Map<number, string>,
) => {
  const {
    analysis: { selector },
  } = config;
  const sieveList = selector.map((s) => sieveMap.get(s)!);
  const schemeData = schemeList.map(
    () => new Map<SieveName, number | number[]>(),
  );
  const exclusion = schemeList.map(() => false);
  for (const sieve of sieveList) {
    let min: number | number[] | undefined;
    for (const [index, scheme] of schemeList.entries()) {
      const data = schemeData[index]!;
      const excluded = exclusion[index]!;
      if (excluded) continue;
      const value = sieve.key(scheme, component, config, rootMap);
      data.set(sieve.title, value);
      if (min === undefined) {
        min = value;
      } else if (isLess(value, min)) {
        min = value;
      }
    }
    schemeData.forEach((data, index) => {
      if (data.get(sieve.title) !== min) {
        exclusion[index] = true;
      }
    });
  }
  if (exclusion.filter((x) => !x).length !== 1) {
    console.error("undetermined component", component.name);
  }
  return [schemeList.find((v, i) => !exclusion[i])!, schemeData] as const;
};

export type { Scheme, Sieve };

export default select;
