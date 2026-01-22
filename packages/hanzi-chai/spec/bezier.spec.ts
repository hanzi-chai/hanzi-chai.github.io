import { expect, describe, it } from "vitest";
import { area, 区间 } from "../src/main";
import type { Draw, Point, Tuple, 笔画关系 } from "../src/main";
import { 一次曲线, 三次曲线, } from "../src/main";
import { 获取数据 } from ".";

const { 部件图形库 } = 获取数据();

describe("区间关系", () => {
  it("一般情况", () => {
    expect(new 区间(10, 20).比较(new 区间(30, 40))).toBe(-1);
    expect(new 区间(10, 20).比较(new 区间(20, 40))).toBe(-0.5);
    expect(new 区间(40, 50).比较(new 区间(30, 40))).toBe(0.5);
    expect(new 区间(50, 70).比较(new 区间(30, 40))).toBe(1);
  });
  it("边界情况", () => {
    expect(new 区间(10, 20).比较(new 区间(21, 25))).toBe(-1);
    expect(new 区间(10, 20).比较(new 区间(15, 25))).toBe(-0.5);
    expect(new 区间(10, 30).比较(new 区间(14, 25))).toBe(0);
    expect(new 区间(20, 30).比较(new 区间(16, 25))).toBe(0.5);
    expect(new 区间(27, 34).比较(new 区间(16, 25))).toBe(1);
  });
});

describe("一次曲线关系", () => {
  const { 田 } = 部件图形库;
  const [l, t, r, h, v, b] = 田!._笔画列表().flatMap((x) => x.curveList) as Tuple<一次曲线, 6>;
  it("计算「田」中的所有关系", () => {
    expect(l.计算关系(t)).toEqual({
      type: "连",
      first: "前",
      second: "前",
    });
    expect(t.计算关系(r)).toEqual({
      type: "连",
      first: "后",
      second: "前",
    });
    expect(r.计算关系(b)).toEqual({
      type: "连",
      first: "后",
      second: "后",
    });
    expect(l.计算关系(h)).toEqual({
      type: "连",
      first: "中",
      second: "前",
    });
    expect(r.计算关系(h)).toEqual({
      type: "连",
      first: "中",
      second: "后",
    });
    expect(v.计算关系(b)).toEqual({
      type: "连",
      first: "后",
      second: "中",
    });
    expect(h.计算关系(v)).toEqual({ type: "交" });
  });
});

describe("一次曲线关系 2", () => {
  const { 艹 } = 部件图形库;
  const [_, s1, s2] = 艹!._笔画列表().flatMap((x) => x.curveList) as Tuple<一次曲线, 3>;
  it("计算「艹」中的关系", () => {
    expect(s1.计算关系(s2)).toEqual({
      type: "平行",
      mainAxis: 0,
      crossAxis: -1,
    });
  });
});

describe("三次曲线关系", () => {
  it("计算「天」中的所有关系", () => {
    const { 天 } = 部件图形库;
    const [c1, c2, c3, c4] = 天!._笔画列表().flatMap((x) => x.curveList) as [
      一次曲线,
      一次曲线,
      三次曲线,
      三次曲线,
    ];
    expect(c1.计算关系(c3)).toEqual({
      type: "连",
      first: "中",
      second: "前",
    });
    expect(c1.计算关系(c4)).toEqual({ type: "垂直", x: 0, y: -1 });
    expect(c2.计算关系(c3)).toEqual({ type: "交" });
    expect(c2.计算关系(c4)).toEqual({
      type: "连",
      first: "中",
      second: "前",
    });
    expect(c3.计算关系(c4)).toEqual({
      type: "连",
      first: "中",
      second: "前",
    });
  });
  it("计算「义」中的所有关系", () => {
    const { 义 } = 部件图形库;
    const [c1, c2, c3] = 义!._笔画列表().flatMap((x) => x.curveList) as Tuple<三次曲线, 3>;
    expect(c1.计算关系(c2)).toEqual({
      type: "平行",
      crossAxis: 0,
      mainAxis: -0.5,
    });
    expect(c1.计算关系(c3)).toEqual({
      type: "平行",
      crossAxis: 0,
      mainAxis: -0.5,
    });
    expect(c2.计算关系(c3)).toEqual({ type: "交" });
  });
  it("计算「升」中的所有关系", () => {
    const 升 = 部件图形库.升;
    const [c1, c2, c3, c4] = 升!._笔画列表().flatMap((x) => x.curveList) as [
      三次曲线,
      一次曲线,
      三次曲线,
      一次曲线
    ];
    expect(c1.计算关系(c2)).toEqual({
      type: "平行",
      mainAxis: 0,
      crossAxis: -1,
    });
    expect(c2.计算关系(c3)).toEqual({ type: "交" });
    expect(c2.计算关系(c4)).toEqual({ type: "交" });
  });
});

describe("面积计算", () => {
  it("正的旋转角度时返回正值", () => {
    expect(area([1, 0], [0, 2])).toBeCloseTo(2);
  });
  it("负的旋转角度时返回负值", () => {
    expect(area([0, 1], [2, 0])).toBeCloseTo(-2);
  });
});

describe("工厂函数", () => {
  const p0 = [12, 34] as Point;
  const d1: Draw = { command: "c", parameterList: [5, 8, 23, 15, 49, 33] };
  const d2: Draw = { command: "h", parameterList: [10] };
  const d3: Draw = { command: "v", parameterList: [20] };
  it("makes cubic curves", () => {
    expect(三次曲线.从绘制创建(p0, d1).evaluate(1)).toEqual([61, 67]);
  });
  it("makes linear curves", () => {
    expect(一次曲线.从绘制创建(p0, d2).evaluate(1)).toEqual([22, 34]);
    expect(一次曲线.从绘制创建(p0, d3).evaluate(1)).toEqual([12, 54]);
  });
});

describe("find topology interface", () => {
  it("works for a simple case", () => {
    const { 土 } = 部件图形库;
    const array: 笔画关系[][] = [
      [[], [{ type: "交" }], [{ type: "平行", mainAxis: 0, crossAxis: -1 }]],
      [[{ type: "交" }], [], [{ type: "连", first: "后", second: "中" }]],
      [
        [{ type: "平行", mainAxis: 0, crossAxis: 1 }],
        [{ type: "连", first: "中", second: "后" }],
        [],
      ],
    ];
    expect(土!._拓扑()).toEqual({
      matrix: array,
      orientedPairs: [[2, 0]],
    });
  });
});
