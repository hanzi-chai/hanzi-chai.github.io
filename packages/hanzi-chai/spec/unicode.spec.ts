import { describe, expect, it } from "vitest";
import { 获取数据 } from "./index.js";
import { 字集指示 } from "../src/index.js";

const { 字库 } = 获取数据();

describe("字集过滤", () => {
  const specifiers: 字集指示[] = ["minimal", "gb2312", "general", "basic", "extended", "supplement", "maximal"];
  const 汉字数量 = [6638, 6763, 8105, 21265, 101984, 102374, 109902];
  it("能够分析拼音", () => {
    for (let i = 0; i < specifiers.length; i++) {
      const 指示 = specifiers[i]!;
      const 结果 = 字库.过滤(指示);
      expect(结果.length).toBe(汉字数量[i]);
    }
  });
});
