import { expect, describe, it } from "vitest";
import type { StrokeRelation, CubicCurve, LinearCurve } from "~/lib";
import { findTopology, curveRelation } from "~/lib";
import { area } from "~/lib";
import type { Draw, Point } from "~/lib";
import { computedGlyphs2 as computedGlyphs } from "./mock";
import { getIntervalPosition, makeCurve } from "~/lib";

describe("interval position", () => {
  it("works for easy cases", () => {
    expect(getIntervalPosition([10, 20], [30, 40])).toBe(-1);
    expect(getIntervalPosition([10, 20], [20, 40])).toBe(-0.5);
    expect(getIntervalPosition([40, 50], [30, 40])).toBe(0.5);
    expect(getIntervalPosition([50, 70], [30, 40])).toBe(1);
  });
  it("works for trickier cases", () => {
    expect(getIntervalPosition([10, 20], [21, 25])).toBe(-1);
    expect(getIntervalPosition([10, 20], [15, 25])).toBe(-0.5);
    expect(getIntervalPosition([10, 30], [14, 25])).toBe(0);
    expect(getIntervalPosition([20, 30], [16, 25])).toBe(0.5);
    expect(getIntervalPosition([27, 34], [16, 25])).toBe(1);
  });
});

describe("linear relation", () => {
  const { 田 } = computedGlyphs;
  const [l, t, r, h, v, b] = 田!.map((x) => x.curveList).flat() as [
    LinearCurve,
    LinearCurve,
    LinearCurve,
    LinearCurve,
    LinearCurve,
    LinearCurve,
  ];
  it("figures out all relations in 田", () => {
    expect(curveRelation(l, t)).toEqual({
      type: "连",
      first: "前",
      second: "前",
    });
    expect(curveRelation(t, r)).toEqual({
      type: "连",
      first: "后",
      second: "前",
    });
    expect(curveRelation(r, b)).toEqual({
      type: "连",
      first: "后",
      second: "后",
    });
    expect(curveRelation(l, h)).toEqual({
      type: "连",
      first: "中",
      second: "前",
    });
    expect(curveRelation(r, h)).toEqual({
      type: "连",
      first: "中",
      second: "后",
    });
    expect(curveRelation(v, b)).toEqual({
      type: "连",
      first: "后",
      second: "中",
    });
    expect(curveRelation(h, v)).toEqual({ type: "交" });
  });
});

describe("linear relation 2", () => {
  const { 艹 } = computedGlyphs;
  const [_, s1, s2] = 艹!.map((x) => x.curveList).flat() as [
    LinearCurve,
    LinearCurve,
    LinearCurve,
  ];
  it("figures out all relations in 艹", () => {
    expect(curveRelation(s1, s2)).toEqual({
      type: "平行",
      mainAxis: 0,
      crossAxis: -1,
    });
  });
});

describe("curve relation", () => {
  it("figures out all relations in 天", () => {
    const { 天 } = computedGlyphs;
    const [c1, c2, c3, c4] = 天!.map((x) => x.curveList).flat() as [
      LinearCurve,
      LinearCurve,
      CubicCurve,
      CubicCurve,
    ];
    expect(curveRelation(c1, c3)).toEqual({
      type: "连",
      first: "中",
      second: "前",
    });
    expect(curveRelation(c1, c4)).toEqual({ type: "散", x: 0, y: -1 });
    expect(curveRelation(c2, c3)).toEqual({ type: "交" });
    expect(curveRelation(c2, c4)).toEqual({
      type: "连",
      first: "中",
      second: "前",
    });
    expect(curveRelation(c3, c4)).toEqual({
      type: "连",
      first: "中",
      second: "前",
    });
  });
  it("figures out all relations in 义", () => {
    const { 义 } = computedGlyphs;
    const [c1, c2, c3] = 义!.map((x) => x.curveList).flat() as [
      CubicCurve,
      CubicCurve,
      CubicCurve,
    ];
    expect(curveRelation(c1, c2)).toEqual({
      type: "平行",
      crossAxis: 0,
      mainAxis: -0.5,
    });
    expect(curveRelation(c1, c3)).toEqual({
      type: "平行",
      crossAxis: 0,
      mainAxis: -0.5,
    });
    expect(curveRelation(c2, c3)).toEqual({ type: "交" });
  });
  it("figures out all relations in 升", () => {
    const { 升 } = computedGlyphs;
    const [c1, c2, c3, c4] = 升!.map((x) => x.curveList).flat() as [
      CubicCurve,
      LinearCurve,
      CubicCurve,
      LinearCurve,
    ];
    expect(curveRelation(c1, c2)).toEqual({
      type: "平行",
      mainAxis: 0,
      crossAxis: -1,
    });
    expect(curveRelation(c2, c3)).toEqual({ type: "交" });
    expect(curveRelation(c2, c4)).toEqual({ type: "交" });
  });
});

describe("area", () => {
  it("gives positive value for postive rotation angle", () => {
    expect(area([1, 0], [0, 2])).toBeCloseTo(2);
  });
  it("gives negative value for negative rotation angle", () => {
    expect(area([0, 1], [2, 0])).toBeCloseTo(-2);
  });
});

describe("factory", () => {
  const p0 = [12, 34] as Point;
  const d1: Draw = { command: "c", parameterList: [5, 8, 23, 15, 49, 33] };
  const d2: Draw = { command: "h", parameterList: [10] };
  const d3: Draw = { command: "v", parameterList: [20] };
  const c1: CubicCurve = {
    type: "cubic",
    orientation: "vertical",
    controls: [
      [12, 34],
      [17, 42],
      [35, 49],
      [61, 67],
    ],
  };
  const c2: LinearCurve = {
    type: "linear",
    orientation: "horizontal",
    controls: [
      [12, 34],
      [22, 34],
    ],
  };
  const c3: LinearCurve = {
    type: "linear",
    orientation: "vertical",
    controls: [
      [12, 34],
      [12, 54],
    ],
  };
  it("makes cubic curves", () => {
    expect(makeCurve(p0, d1)).toEqual(c1);
  });
  it("makes linear curves", () => {
    expect(makeCurve(p0, d2)).toEqual(c2);
    expect(makeCurve(p0, d3)).toEqual(c3);
  });
});

describe("find topology interface", () => {
  it("works for a simple case", () => {
    const { 土 } = computedGlyphs;
    const array: StrokeRelation[][] = [
      [[], [{ type: "交" }], [{ type: "平行", mainAxis: 0, crossAxis: -1 }]],
      [[{ type: "交" }], [], [{ type: "连", first: "后", second: "中" }]],
      [
        [{ type: "平行", mainAxis: 0, crossAxis: 1 }],
        [{ type: "连", first: "中", second: "后" }],
        [],
      ],
    ];
    expect(findTopology(土!)).toEqual({
      matrix: array,
      orientedPairs: [[2, 0]],
    });
  });
});
