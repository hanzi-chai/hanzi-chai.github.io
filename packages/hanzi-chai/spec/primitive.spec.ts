import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { 矢量图形数据, 默认分类器 } from "~/lib";
import { 获取数据 } from ".";
import { 是基本区汉字 } from "../src/unicode";

const { 字库, 原始字库 } = 获取数据();

describe("e2e test", () => {
  it("checks stroke orders are correct", () => {
    const tygf = new Map(
      readFileSync("../../public/cache/tygf.txt", "utf-8")
        .trim()
        .split("\n")
        .map((x) => x.trim().split("\t") as [string, string]),
    );
    const cjk = new Map(
      readFileSync("../../public/cache/cjk.txt", "utf-8")
        .trim()
        .split("\n")
        .map((x) => x.trim().split("\t") as [string, string]),
    );
    const result = new Map<string, string[]>();
    const summarize = (glyph: 矢量图形数据) =>
      glyph.map((x) => 默认分类器[x.feature]).join("");
    for (const [char, { glyphs }] of Object.entries(原始字库._get())) {
      if (!是基本区汉字(char)) continue;
      for (const glyph of glyphs) {
        if (glyph.tags?.includes("中竖截断")) continue;
        if (glyph.tags?.includes("戈部截断")) continue;
        if (glyph.type === "identity") continue;
        let svg: 矢量图形数据 = [];
        if (glyph.type === "basic_component") {
          svg = glyph.strokes;
        } else if (
          glyph.type === "derived_component" ||
          glyph.type === "spliced_component"
        ) {
          const svgglyph = 原始字库.递归渲染原始字形(glyph);
          if (svgglyph.ok) {
            const value = svgglyph.value;
            if (value.type === "basic_component") {
              svg = value.strokes;
            }
          }
        } else {
          const svgglyph = 字库.递归渲染复合体(glyph);
          if (svgglyph.ok) {
            const value = svgglyph.value;
            svg = value.获取笔画列表();
          }
        }
        result.set(char, (result.get(char) ?? []).concat(summarize(svg)));
      }
    }
    let differences = 0;
    for (const [char, orders] of result) {
      const referenceOrder = tygf.get(char) ?? cjk.get(char);
      if (referenceOrder === undefined) continue;
      for (const order of orders) {
        if (order !== referenceOrder) {
          differences += 1;
          console.log(char, order, referenceOrder);
        }
      }
    }
    expect(differences).toBeLessThan(30);
  });
});
