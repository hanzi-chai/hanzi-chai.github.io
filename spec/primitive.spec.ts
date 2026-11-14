import { describe, expect, it, beforeAll } from "bun:test";
import {
  默认分类器,
  获取通用规范汉字笔画数据,
  获取CJK汉字笔画数据,
} from "../src/index.js";
import type { 字库 as 字库类型 } from "../src/index.js";
import { 获取数据 } from "./index.js";

let 字库: 字库类型;

beforeAll(() => {
  ({ 字库 } = 获取数据());
});

describe("笔顺数据验证", () => {
  it("基本区汉字的笔顺应基本正确", () => {
    const tygf = 获取通用规范汉字笔画数据();
    const cjk = 获取CJK汉字笔画数据();
    const result = new Map<string, string>();
    for (const [, 数据] of 字库) {
      const 字符 = 数据.character;
      if (!字符.是基本区汉字()) continue;
      const 字形列表 = 字库.查询字符的字形(字符);
      if (!字形列表) continue;
      for (const glyph of 字形列表) {
        result.set(字符.获取名称(), glyph.获取笔画序列(默认分类器).join(""));
        break;
      }
    }
    const differences: { char: string; actual: string; expected: string }[] =
      [];
    for (const [char, order] of result) {
      const referenceOrder = tygf.get(char) ?? cjk.get(char);
      if (referenceOrder === undefined) continue;
      if (order !== referenceOrder) {
        differences.push({ char, actual: order, expected: referenceOrder });
      }
    }
    expect(differences.length, JSON.stringify(differences)).toBeLessThanOrEqual(
      50,
    );
  });
});
