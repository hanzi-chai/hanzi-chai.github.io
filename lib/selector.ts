import { ComponentData, ComponentResult, SchemeWithData } from "./chai";
import { SieveName } from "./config";
import { Component, Glyph } from "./data";
import { binaryToIndices } from "./degenerator";
import { Relation } from "./topology";
import { isEqual } from "underscore";

type Scheme = number[];

type Sieve<T extends number | number[]> = {
  name: string;
  key: (component: ComponentData, scheme: Scheme) => T;
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
  name: "length",
  key: (_, scheme) => scheme.length,
};

const countStrokes: (n: number) => number = (n) =>
  n < 2 ? n : (n & 1) + countStrokes(n >>> 1);

export const bias: Sieve<number[]> = {
  name: "bias",
  key: (_, scheme) => scheme.map(countStrokes).map((x) => -x),
};

export const order: Sieve<number[]> = {
  name: "order",
  key: (component, scheme) => {
    return scheme.map((x) => binaryToIndices(component.glyph.length)(x)).flat();
  },
};

export const makeTopologySieve = function (
  relationType: Relation["type"],
  name: string,
): Sieve<number> {
  let key: Sieve<number>["key"] = (component, scheme) => {
    const parsedScheme = scheme.map((x) =>
      binaryToIndices(component.glyph.length)(x),
    );
    let totalCrosses = 0;
    for (const [i, bi] of parsedScheme.entries()) {
      for (const [j, bj] of parsedScheme.entries()) {
        if (j >= i) continue;
        let cross = false;
        for (const k of bi) {
          for (const l of bj) {
            const [smaller, larger] = [Math.min(k, l), Math.max(k, l)];
            const relations = component.topology[larger][smaller];
            cross ||= relations.some((v) => v.type === relationType);
          }
        }
        totalCrosses += +cross;
      }
    }
    return totalCrosses;
  };
  return { name, key };
};

export const crossing = makeTopologySieve("交", "crossing");

export const attaching = makeTopologySieve("连", "attaching");

export const sieveMap = new Map<SieveName, Sieve<number> | Sieve<number[]>>([
  ["根少优先", length],
  ["笔顺优先", order],
  ["取大优先", bias],
  ["能连不交", crossing],
  ["能散不连", attaching],
]);

const select = (
  sieveList: (Sieve<number> | Sieve<number[]>)[],
  componentData: ComponentData,
  schemeList: Scheme[],
  rootMap: Map<number, string>,
) => {
  const lookup = (n: number) => rootMap.get(n)!;
  let currentSchemeList = [...schemeList];
  let schemeData = new Map<string, Partial<SchemeWithData>>();
  schemeList.forEach((v) => {
    schemeData.set(v.toString(), {
      key: v.toString(),
      roots: v.map(lookup),
    });
  });
  for (const sieve of sieveList) {
    const scoreList = currentSchemeList.map((x) => {
      const v = sieve.key(componentData, x);
      const obj = schemeData.get(x.toString())!;
      obj[sieve.name as "order"] = v as number[];
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
  const parsedRootMap = [...rootMap.entries()].map(([k, v]) => [
    binaryToIndices(componentData.glyph.length)(k),
    v,
  ]);
  if (currentSchemeList.length === 1) {
    return {
      best: currentSchemeList[0].map(lookup),
      map: parsedRootMap,
      schemes: [...schemeData.values()],
    } as ComponentResult;
  } else {
    console.error(
      "undetermined component",
      componentData.name,
      schemeList,
      currentSchemeList,
    );
    return {
      best: currentSchemeList[0].map(lookup),
      map: parsedRootMap,
      schemes: [...schemeData.values()],
    } as ComponentResult;
  }
};

export type { Scheme, Sieve };

export default select;
