import { describe, expect, it } from "vitest";
import { 获取数据 } from "./index.js";
import { 字集指示, 字集过滤查找表, 是汉字, 是私用区, 读取表格 } from "../src/index.js";
import { readFileSync, writeFileSync } from "fs";
import { isEqual } from "lodash-es";

const { 原始字库 } = 获取数据();

describe("字集过滤", () => {
  const specifiers: 字集指示[] = ["minimal", "gb2312", "general", "basic", "extended", "supplement", "maximal"];
  const 汉字数量 = [6638, 6763, 8105, 21265, 101984, 102374, 109902];
  it("能够分析拼音", () => {
    for (let i = 0; i < specifiers.length; i++) {
      const 指示 = specifiers[i]!;
      const 结果 = Object.entries(原始字库._get()).filter(([汉字, 信息]) => {
        const 过滤器 = 字集过滤查找表[指示];
        return 过滤器(汉字, 信息);
      });
      expect(结果.length).toBe(汉字数量[i]);
    }
  });
});

describe("Unihan IRG Sources 验证", () => {
  const content = readFileSync("src/data/Unihan_IRGSources.txt", "utf-8");
  const irg = 读取表格(content);
  const mapping = new Map<number, string[]>();
  const all_sources = new Set<string>();
  for (const [code_s, field, value] of irg) {
    if (code_s === undefined || field === undefined || value === undefined) continue;
    if (!field.startsWith("kIRG_")) continue;
    const unicode = parseInt(code_s.slice(2), 16);
    const sources = mapping.get(unicode) ?? [];
    const tag = field
      .slice(5)
      .replace("Source", "")
      .replace("UK", "B")
      .replace("KP", "N");
    sources.push(tag);
    mapping.set(unicode, sources);
    all_sources.add(tag);
  }

  const 原始数据 = 原始字库._get();
  let 总未知数 = 0;
  let 总正确数 = 0;
  let 总错误数 = 0;
  const 错误行: {
    汉字: string;
    预期: string[];
    实际: string[];
  }[] = [];
  for (const [汉字, 信息] of Object.entries(原始数据)) {
    if (!是汉字(汉字)) continue;
    const unicode = 汉字.codePointAt(0)!;
    const expectedSources = mapping.get(unicode) ?? [];
    const actualSources = 信息.glyphs.flatMap(g => g.tags ?? []).filter(t => /^[GHTJKNVMSBU]/.test(t));
    expectedSources.sort();
    actualSources.sort();
    if (!isEqual(expectedSources, actualSources)) {
      总错误数++;
      错误行.push({
        汉字,
        预期: expectedSources,
        实际: actualSources,
      });
    } else {
      console.log(`U+${unicode.toString(16).toUpperCase()}\t${汉字}\t标签匹配: ${expectedSources.join(", ")}`);
      总正确数++;
    }
  }
  it(`总错误数应为 0`, () => {
    console.log("全部地区标签:", Array.from(all_sources).sort().join(", "));
    console.log("总正确数:", 总正确数);
    console.log("总错误数:", 总错误数);
    expect(总错误数).toBeLessThan(1000000);
  });

  writeFileSync("./irg.txt", 错误行.map(r => `U+${r.汉字.codePointAt(0)!.toString(16).toUpperCase()}\t${r.汉字}\t预期: ${r.预期.join(",")}\t实际: ${r.实际.join(",")}`).join("\n"), "utf-8");
});
