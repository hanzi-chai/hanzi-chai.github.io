import { expect, describe, it, beforeAll } from "bun:test";
import { 一次曲线, 三次曲线, 叉乘, 区间 } from "../src/index.js";
import type { 绘制, 向量, Tuple, 笔画关系, 部件 } from "../src/index.js";
import { 获取数据 } from "./index.js";

let 部件图形库: Record<string, 部件>;

beforeAll(() => {
  ({ 部件图形库 } = 获取数据());
});

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
  let l: 一次曲线, t: 一次曲线, r: 一次曲线, h: 一次曲线, v: 一次曲线, b: 一次曲线;
  let s1: 一次曲线, s2: 一次曲线;

  beforeAll(() => {
    [l, t, r, h, v, b] = 部件图形库.田!._笔画列表().flatMap((x) => x.curveList) as Tuple<一次曲线, 6>;
    const [, _s1, _s2] = 部件图形库.艹!._笔画列表().flatMap((x) => x.curveList) as Tuple<一次曲线, 3>;
    s1 = _s1!; s2 = _s2!;
  });

  it("计算「田」中的所有关系", () => {
    expect(l.计算关系(t)).toEqual({ type: "连", first: "前", second: "前" });
    expect(t.计算关系(r)).toEqual({ type: "连", first: "后", second: "前" });
    expect(r.计算关系(b)).toEqual({ type: "连", first: "后", second: "后" });
    expect(l.计算关系(h)).toEqual({ type: "连", first: "中", second: "前" });
    expect(r.计算关系(h)).toEqual({ type: "连", first: "中", second: "后" });
    expect(v.计算关系(b)).toEqual({ type: "连", first: "后", second: "中" });
    expect(h.计算关系(v)).toEqual({ type: "交" });
  });

  it("计算「艹」中的平行关系", () => {
    expect(s1.计算关系(s2)).toEqual({ type: "平行", mainAxis: 0, crossAxis: -1 });
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
    expect(c1.计算关系(c3)).toEqual({ type: "连", first: "中", second: "前" });
    expect(c1.计算关系(c4)).toEqual({ type: "垂直", x: 0, y: -1 });
    expect(c2.计算关系(c3)).toEqual({ type: "交" });
    expect(c2.计算关系(c4)).toEqual({ type: "连", first: "中", second: "前" });
    expect(c3.计算关系(c4)).toEqual({ type: "连", first: "中", second: "前" });
  });
  it("计算「义」中的所有关系", () => {
    const { 义 } = 部件图形库;
    const [c1, c2, c3] = 义!._笔画列表().flatMap((x) => x.curveList) as Tuple<三次曲线, 3>;
    expect(c1.计算关系(c2)).toEqual({ type: "平行", crossAxis: 0, mainAxis: -0.5 });
    expect(c1.计算关系(c3)).toEqual({ type: "平行", crossAxis: 0, mainAxis: -0.5 });
    expect(c2.计算关系(c3)).toEqual({ type: "交" });
  });
  it("计算「升」中的所有关系", () => {
    const 升 = 部件图形库.升;
    const [c1, c2, c3, c4] = 升!._笔画列表().flatMap((x) => x.curveList) as [
      三次曲线,
      一次曲线,
      三次曲线,
      一次曲线,
    ];
    expect(c1.计算关系(c2)).toEqual({ type: "平行", mainAxis: 0, crossAxis: -1 });
    expect(c2.计算关系(c3)).toEqual({ type: "交" });
    expect(c2.计算关系(c4)).toEqual({ type: "交" });
  });
});

describe("面积计算", () => {
  it("正的旋转角度时返回正值", () => {
    expect(叉乘([1, 0], [0, 2])).toBeCloseTo(2);
  });
  it("负的旋转角度时返回负值", () => {
    expect(叉乘([0, 1], [2, 0])).toBeCloseTo(-2);
  });
});

describe("工厂函数", () => {
  const p0 = [12, 34] as 向量;
  const d1: 绘制 = { command: "c", parameterList: [5, 8, 23, 15, 49, 33] };
  const d2: 绘制 = { command: "h", parameterList: [10] };
  const d3: 绘制 = { command: "v", parameterList: [20] };
  it("从绘制创建三次曲线", () => {
    expect(三次曲线.从绘制创建(p0, d1).求值(1)).toEqual([61, 67]);
  });
  it("从绘制创建一次曲线", () => {
    expect(一次曲线.从绘制创建(p0, d2).求值(1)).toEqual([22, 34]);
    expect(一次曲线.从绘制创建(p0, d3).求值(1)).toEqual([12, 54]);
  });
});

describe("拓扑结构计算", () => {
  it("计算「土」的拓扑结构", () => {
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
    expect(土!._拓扑()).toEqual({ matrix: array, orientedPairs: [[2, 0]] });
  });
});
