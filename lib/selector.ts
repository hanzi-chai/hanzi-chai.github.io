import { ComponentResult, SchemeWithData } from "./chai";
import { Component, Glyph } from "./data";

type Scheme = number[];

type Sieve = (component: Glyph, scheme: Scheme) => number | number[];

export const length: Sieve = (_, scheme) => scheme.length;

const countStrokes: (n: number) => number = (n) =>
  n < 2 ? n : (n & 1) + countStrokes(n >>> 1);

export const bias: Sieve = (_, scheme) =>
  scheme.map(countStrokes).map((x) => -x);

export const order: Sieve = (component, scheme) => {
  const indices = [...Array(component.length).keys()];
  const b = 1 << (component.length - 1);
  return scheme.map((n) => indices.filter((i) => n & (b >> i))).flat();
};

export const crossing: Sieve = (_, __) => -1;

export const attaching: Sieve = (_, __) => -1;

const select = (
  sieveList: Sieve[],
  name: string,
  component: Glyph,
  schemeList: Scheme[],
  rootMap: Map<number, string>,
) => {
  const lookup = (n: number) => rootMap.get(n)!;
  let currentSchemeList = [...schemeList];
  const schemeData = new Map<string, Partial<SchemeWithData>>();
  schemeList.forEach((v) => {
    schemeData.set(v.toString(), {
      key: v.toString(),
      roots: v.map(lookup),
      attaching: -1,
      crossing: -1,
    });
  });
  for (const sieve of sieveList) {
    const scoreList = currentSchemeList.map((x) => {
      const v = sieve(component, x);
      const obj = schemeData.get(x.toString())!;
      const field = sieve.name as "order" | "bias";
      obj[field] = v as number[];
      return v;
    });
    let min = typeof scoreList[0] === "number" ? Infinity : [Infinity];
    for (const score of scoreList) {
      if (score < min) min = score;
    }
    currentSchemeList = currentSchemeList.filter(
      (_, index) => scoreList[index] === min,
    );
  }
  if (currentSchemeList.length === 1) {
    return {
      best: currentSchemeList[0].map(lookup),
      schemes: [...schemeData.values()],
    } as ComponentResult;
  }
  throw new Error("undetermined component");
};

export type { Scheme, Sieve };

export default select;
