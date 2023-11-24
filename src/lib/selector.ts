import { Cache } from "./form";
import { Selector, SieveName } from "./config";
import { binaryToIndices } from "./degenerator";
import { isEqual } from "underscore";
import { CurveRelation } from "./topology";

type Scheme = number[];

type Comparable = number | number[];

type Sieve<T extends Comparable> = {
  title: SieveName;
  key: (component: Cache, scheme: Scheme) => T;
  display?: (data: T) => string;
};

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
  key: (_, scheme) => scheme.length,
};

const countStrokes: (n: number) => number = (n) =>
  n < 2 ? n : (n & 1) + countStrokes(n >>> 1);

export const bias: Sieve<number[]> = {
  title: "取大优先",
  key: (_, scheme) => scheme.map(countStrokes).map((x) => -x),
  display: (data: number[]) => "(" + data.map((x) => -x).join(", ") + ")",
};

export const order: Sieve<number> = {
  title: "笔顺优先",
  key: (component, scheme) => {
    const indices = scheme
      .map((x) => binaryToIndices(component.glyph.length)(x))
      .flat();
    const isSorted = indices.slice(1).every((v, i) => indices[i]! < v);
    return +!isSorted;
  },
};

const makeTopologySieve = function (
  relationType: CurveRelation["type"],
  avoidRelationType: CurveRelation["type"][],
  title: SieveName,
): Sieve<number> {
  const key: Sieve<number>["key"] = (component, scheme) => {
    const parsedScheme = scheme.map((x) =>
      binaryToIndices(component.glyph.length)(x),
    );
    let totalCrosses = 0;
    for (const [i, bi] of parsedScheme.entries()) {
      for (const [j, bj] of parsedScheme.entries()) {
        if (j >= i) continue;
        let r = false,
          a = false;
        for (const k of bi) {
          for (const l of bj) {
            const [smaller, larger] = [Math.min(k, l), Math.max(k, l)];
            const relations = component.topology[larger]![smaller]!;
            r ||= relations.some((v) => v.type === relationType);
            a ||= relations.some((v) => avoidRelationType.includes(v.type));
          }
        }
        if (!a) totalCrosses += +r;
      }
    }
    return totalCrosses;
  };
  return { key, title };
};

export const crossing = makeTopologySieve("交", [], "能连不交");

export const attaching = makeTopologySieve("连", ["交"], "能散不连");

export const sieveMap = new Map<SieveName, Sieve<number> | Sieve<number[]>>(
  [length, order, bias, crossing, attaching].map((x) => [x.title, x]),
);

const select = (selector: Selector, component: Cache, schemeList: Scheme[]) => {
  const sieveList = selector.map((s) => sieveMap.get(s)!);
  const schemeData = schemeList.map(
    (_) => new Map<SieveName, number | number[]>(),
  );
  const exclusion = schemeList.map((_) => false);
  for (const sieve of sieveList) {
    let min: number | number[] | undefined;
    for (const [index, scheme] of schemeList.entries()) {
      const data = schemeData[index]!;
      const excluded = exclusion[index]!;
      if (excluded) continue;
      const value = sieve.key(component, scheme);
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
