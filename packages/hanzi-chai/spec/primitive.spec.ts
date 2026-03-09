import { describe, expect, it } from "vitest";
import { 矢量图形数据, 默认分类器, 是基本区汉字, 获取通用规范汉字笔画数据, 获取CJK汉字笔画数据 } from "../src/index.js";
import { 获取数据 } from "./index.js";

const { 字库, 原始字库 } = 获取数据();

describe("e2e test", () => {
  it("checks stroke orders are correct", { timeout: 50000 }, () => {
    const tygf = 获取通用规范汉字笔画数据();
    const cjk = 获取CJK汉字笔画数据();
    const result = new Map<string, string>();
    for (const [char, { glyphs }] of Object.entries(字库._get())) {
      if (!是基本区汉字(char)) continue;
      for (const glyph of glyphs) {
        result.set(char, glyph.获取笔画序列(默认分类器).join(""));
        break;
      }
    }
    let differences = 0;
    for (const [char, order] of result) {
      const referenceOrder = tygf.get(char) ?? cjk.get(char);
      if (referenceOrder === undefined) continue;
      if (order !== referenceOrder) {
        differences += 1;
        console.log(char, order, referenceOrder);
      }
    }
    expect(differences).toBeLessThan(30);
  });
});
