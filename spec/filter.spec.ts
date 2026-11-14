import { describe, expect, it } from "bun:test";
import {
  GF0014映射,
  GF3001映射,
  type 基本字形数据,
  字符字形过滤器,
  构建字库,
  歧义字形,
  type 过滤器参数,
} from "../src/index.js";
import { characters, fixtureConfig, glyphs } from "./fixtures/scheme.js";

const compound: 基本字形数据 = {
  id: 3,
  type: "compound",
  operator: "⿱",
  references: [{ id: 1 }, { id: 2 }],
};
const library = 构建字库(
  fixtureConfig(),
  [
    ...characters,
    { unicode: "三".codePointAt(0)!, glyphs: [{ id: 3, sources: ["T"] }] },
  ],
  [...glyphs, compound],
);
const character = (text: string, filter: 过滤器参数) => {
  const data = library.校验字符(text)!;
  return new 字符字形过滤器(filter).过滤字符(data.character, data, library);
};
const glyph = (text: string, filter: 过滤器参数) => {
  const data = library.校验字符(text)!;
  const value = library.查询字符的字形(data.character)![0]!;
  return new 字符字形过滤器(filter).过滤字形(value, library);
};

describe("字符字形筛选与元数据", () => {
  it("按名称、十六进制/十进制码位、来源和笔顺筛选字符", () => {
    expect(character("一", { id: "4E00" })).toBe(true);
    expect(character("一", { id: "19968" })).toBe(true);
    expect(character("一", { id: "4E01" })).toBe(false);
    expect(character("一", { name: "一", source: "G", sequence: "^1$" })).toBe(
      true,
    );
    expect(character("二", { sequence: "^1$" })).toBe(false);
    expect(character("三", { source: "T" })).toBe(true);
    expect(character("三", { source: "G" })).toBe(false);
  });

  it("按字形编号、字符别名、复合结构和分部筛选，忽略无效笔顺正则", () => {
    expect(
      glyph("三", { id: "3", name: "三", operator: "⿱", part: "2" }),
    ).toBe(true);
    expect(glyph("三", { operator: "⿰" })).toBe(false);
    expect(glyph("一", { part: "1" })).toBe(false);
    expect(character("三", { operator: "⿱", part: "1" })).toBe(true);
    expect(glyph("一", { sequence: "[" })).toBe(true);
    expect(glyph("一", { name: "二" })).toBe(false);
  });

  it("核心入口提供原有字形编号和歧义标记", () => {
    expect(GF0014映射.get(0x00000)).toBe(138);
    expect(GF3001映射.get(0x00000)).toBe(2);
    expect(歧义字形.has(0x00203)).toBe(true);
    expect(歧义字形.has(1)).toBe(false);
  });
});
