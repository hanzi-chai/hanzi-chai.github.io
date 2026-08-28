import { describe, it, expect } from "bun:test";
import { 字库, 字形库 } from "../src/index.js";
import type { 基本部件数据, 字符数据, 字符数据补丁 } from "../src/index.js";

const 部件数据: 基本部件数据 = {
  type: "component",
  id: 1,
  operator: undefined,
  references: undefined,
  strokes: [
    { feature: "横", start: [0, 0], curveList: [{ command: "h", parameterList: [100] }] },
  ],
};

const 字符列表: 字符数据[] = [
  { unicode: "一".codePointAt(0)!, glyphs: [{ id: 1, sources: ["G"] }] },
];

describe("字形库与字库的分阶段构造", () => {
  it("字符数据变化时复用同一字形库实例的字形", () => {
    const 字形库实例 = new 字形库([部件数据]);
    const 字库一 = new 字库(字符列表, 字形库实例, ["G"]);
    const 字库二 = new 字库(字符列表, 字形库实例, ["G"]);
    const [[, 字形一]] = [...字库一.字形迭代器()];
    const [[, 字形二]] = [...字库二.字形迭代器()];
    expect(字形一).toBe(字形二);
    // 不同字形库构建的字形实例相互独立
    const 另一字形库实例 = new 字形库([部件数据]);
    const [[, 另一字形]] = [...另一字形库实例.字形迭代器()];
    expect(字形一).not.toBe(另一字形);
  });

  it("字符表随字符列表变化", () => {
    const 字形库实例 = new 字形库([部件数据]);
    const 字库实例 = new 字库(字符列表, 字形库实例, ["G"]);
    expect(字库实例.校验字符("一")?.final_glyphs).toEqual([
      { id: 1, sources: ["G"] },
    ]);
    const 空字库实例 = new 字库([], 字形库实例, ["G"]);
    expect(空字库实例.校验字符("一")).toBeUndefined();
  });

  it("补丁校验原始字形存在性", () => {
    const 字形库实例 = new 字形库([部件数据]);
    const 存在补丁: 字符数据补丁 = { type: "insert", id: 1, sources: ["G"] };
    const 缺失补丁: 字符数据补丁 = { type: "insert", id: 2, sources: ["G"] };
    const 字库实例 = new 字库(
      [{ unicode: "一".codePointAt(0)!, glyphs: [] }],
      字形库实例,
      ["G"],
      { 一: [存在补丁, 缺失补丁] },
    );
    // id 2 不存在于字形库中，对应的补丁被跳过
    expect(字库实例.校验字符("一")?.final_glyphs).toEqual([
      { id: 1, sources: ["G"] },
    ]);
  });
});
