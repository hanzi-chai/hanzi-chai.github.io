import { describe, expect, it } from "bun:test";
import { 图形盒子 } from "../src/affine.js";
import type { 引用数据, 结构描述字符 } from "../src/data.js";
import { 包围内部范围表, 获取包围内部范围 } from "../src/enclosure.js";
import { 仿射合并 } from "../src/utils.js";

const outer = 图形盒子.从笔画列表构建([
  {
    feature: "竖",
    start: [0, 0],
    curveList: [{ command: "v", parameterList: [100] }],
  },
]);
const inner = 图形盒子.从笔画列表构建([
  {
    feature: "横",
    start: [0, 0],
    curveList: [{ command: "h", parameterList: [100] }],
  },
]);
const render = (
  id: number,
  ref: 引用数据 = { id: 1 },
  op: 结构描述字符 = "⿸",
) => 仿射合并([outer, inner], [{ id }, ref], op).获取笔画列表()[1]!;

describe("包围内部范围", () => {
  it("广的内部使用已审核的全局范围", () => {
    expect(render(341)).toEqual({
      feature: "横",
      start: [23, 22],
      curveList: [{ command: "h", parameterList: [73] }],
    });
  });
  it("变形后的户也通过新字形 ID 查表", () => {
    const entry = Object.entries(包围内部范围表).find(
      ([, r]) => r.sourceGlyphId === 608,
    );
    expect(entry).toBeDefined();
    const id = Number(entry![0]);
    expect(id).not.toBe(608);
    expect(render(id)).toEqual({
      feature: "横",
      start: [24, 38],
      curveList: [{ command: "h", parameterList: [72] }],
    });
  });
  it("未登记外框保留原来的半幅布局", () => {
    expect(render(999999)).toEqual({
      feature: "横",
      start: [40, 40],
      curveList: [{ command: "h", parameterList: [50] }],
    });
  });
  it("显式内件坐标优先，部分指定也能覆盖对应方向", () => {
    expect(
      render(341, { id: 1, xbegin: 4, ybegin: 10, xend: 20, yend: 50 }).start,
    ).toEqual([4, 10]);
    expect(render(341, { id: 1, ybegin: 60 }).start).toEqual([23, 60]);
  });
  it("同一字形作为普通左右结构的部分时不使用包围范围", () => {
    expect(render(341, { id: 1 }, "⿰")).toEqual(
      render(999999, { id: 1 }, "⿰"),
    );
    expect(获取包围内部范围({ id: 341 }, "⿱")).toBeUndefined();
  });
  it("外框本身缩放平移时，内件范围随同变换", () => {
    const r = 获取包围内部范围(
      { id: 341, xbegin: 10, ybegin: 20, xend: 90, yend: 80 },
      "⿸",
    )!;
    expect(r.xbegin).toBeCloseTo(28.4);
    expect(r.xend).toBeCloseTo(86.8);
    expect(r.ybegin).toBeCloseTo(33.2);
    expect(r.yend).toBeCloseTo(78.8);
  });
});
