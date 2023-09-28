import { Cache, ComponentResult, SchemeWithData } from "./root";
import { SieveName } from "./config";
import { binaryToIndices } from "./degenerator";
import { Relation } from "./topology";
import { isEqual } from "underscore";

type Scheme = number[];

type Sieve<T extends number | number[]> = {
  title: SieveName;
  name: string;
  key: (component: Cache, scheme: Scheme) => T;
  display?: (data: T) => string;
};

function isLess<T extends number | number[]>(a: T, b: T) {
  if (typeof a === "number" && typeof b === "number") {
    return a < b;
  } else if (Array.isArray(a) && Array.isArray(b)) {
    const n = a.length;
    for (let i = 0; i != n; ++i) {
      if (a[i] < b[i]) return true;
      if (a[i] > b[i]) return false;
    }
    return false;
  }
  return undefined;
}

export const length: Sieve<number> = {
  title: "根少优先",
  name: "length",
  key: (_, scheme) => scheme.length,
};

const countStrokes: (n: number) => number = (n) =>
  n < 2 ? n : (n & 1) + countStrokes(n >>> 1);

export const bias: Sieve<number[]> = {
  title: "取大优先",
  name: "bias",
  key: (_, scheme) => scheme.map(countStrokes).map((x) => -x),
  display: (data: number[]) => "(" + data.map((x) => -x).join(", ") + ")",
};

export const order: Sieve<number[]> = {
  title: "笔顺优先",
  name: "order",
  key: (component, scheme) => {
    return scheme.map((x) => binaryToIndices(component.glyph.length)(x)).flat();
  },
  display: (data: number[]) => "(" + data.join(", ") + ")",
};

const makeTopologySieve = function (
  relationType: Relation["type"],
  avoidRelationType: Relation["type"][],
  name: string,
  title: SieveName,
): Sieve<number> {
  let key: Sieve<number>["key"] = (component, scheme) => {
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
            const relations = component.topology[larger][smaller];
            r ||= relations.some((v) => v.type === relationType);
            a ||= relations.some((v) => avoidRelationType.includes(v.type));
          }
        }
        totalCrosses += +(r && !a);
      }
    }
    return totalCrosses;
  };
  return { name, key, title };
};

export const crossing = makeTopologySieve("交", [], "crossing", "能连不交");

export const attaching = makeTopologySieve(
  "连",
  ["交"],
  "attaching",
  "能散不连",
);

export const sieveMap = new Map<SieveName, Sieve<number> | Sieve<number[]>>(
  [length, order, bias, crossing, attaching].map((x) => [x.title, x]),
);

const select = (
  selector: SieveName[],
  component: Cache,
  schemeList: Scheme[],
) => {
  const sieveList = selector.map((s) => sieveMap.get(s)!);
  let currentSchemeList = [...schemeList];
  let schemeData = new Map<string, Partial<SchemeWithData>>();
  schemeList.forEach((v) => {
    schemeData.set(v.toString(), {
      key: v.toString(),
    });
  });
  for (const sieve of sieveList) {
    const scoreList = currentSchemeList.map((x) => {
      const v = sieve.key(component, x);
      const obj = schemeData.get(x.toString())!;
      obj[sieve.name as "length"] = v as number;
      return v;
    });
    let min = typeof scoreList[0] === "number" ? Infinity : [Infinity];
    for (const score of scoreList) {
      if (isLess(score, min)) min = score;
    }
    currentSchemeList = currentSchemeList.filter((_, index) =>
      isEqual(scoreList[index], min),
    );
  }
  if (currentSchemeList.length !== 1) {
    console.error("undetermined component", component.name);
  }
  return [currentSchemeList[0], schemeData] as [Scheme, typeof schemeData];
};

export type { Scheme, Sieve };

export default select;
