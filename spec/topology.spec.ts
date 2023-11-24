import { expect, describe, it } from "vitest";
import findTopology, {
  CurveRelation,
  StrokeRelation,
  curveRelation,
  renderSVGGlyph,
} from "~/lib/topology";
import { area, render } from "~/lib/bezier";
import { CubicCurve, Draw, LinearCurve, Point } from "~/lib/data";
import { rendered } from "./mock";
import { getIntervalPosition, makeCurve } from "~/lib/bezier";

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
  const { 田 } = rendered;
  const strokes = 田!.map(render);
  const [l, t, r, h, v, b] = strokes
    .map((x) => x.curveList)
    .flat() as LinearCurve[];
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
  const { 艹 } = rendered;
  const strokes = 艹!.map(render);
  const [_, s1, s2] = strokes.map((x) => x.curveList).flat() as LinearCurve[];
  it("figures out all relations in 艹", () => {
    expect(curveRelation(s1, s2)).toEqual({
      type: "散",
      x: -1,
      y: 0,
    });
  });
});

describe("curve relation", () => {
  it("figures out all relations in 天", () => {
    const { 天 } = rendered;
    const strokes = 天!.map(render);
    const [c1, c2, c3, c4] = strokes.map((x) => x.curveList).flat();
    expect(curveRelation(c1, c3)).toEqual({
      type: "连",
      first: "中",
      second: "前",
    });
    expect(curveRelation(c1, c4)).toEqual({ type: "散", x: -0.5, y: -1 });
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
    const { 义 } = rendered;
    const strokes = 义.map(render);
    const [c1, c2, c3] = strokes.map((x) => x.curveList).flat();
    expect(curveRelation(c1, c2)).toEqual({ type: "散", x: 0, y: -0.5 });
    expect(curveRelation(c1, c3)).toEqual({ type: "散", x: 0, y: -0.5 });
    expect(curveRelation(c2, c3)).toEqual({ type: "交" });
  });
  it("figures out all relations in 升", () => {
    const { 升 } = rendered;
    const strokes = 升.map(render);
    const [c1, c2, c3, c4] = strokes.map((x) => x.curveList).flat();
    expect(curveRelation(c1, c2)).toEqual({ type: "散", x: 0, y: -1 });
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
    controls: [
      [12, 34],
      [17, 42],
      [35, 49],
      [61, 67],
    ],
  };
  const c2: LinearCurve = {
    type: "linear",
    controls: [
      [12, 34],
      [22, 34],
    ],
  };
  const c3: LinearCurve = {
    type: "linear",
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
    const { 土 } = rendered;
    const array: StrokeRelation[][] = [
      [],
      [[{ type: "交" }]],
      [
        [{ type: "散", x: 0, y: 1 }],
        [{ type: "连", first: "中", second: "后" }],
      ],
    ];
    expect(findTopology(renderSVGGlyph(土))).toEqual(array);
  });
});
