import { describe, expect, it } from "vitest";
import { 获取数据 } from "./index.js";
import { 字集指示, 字集过滤查找表 } from "../src/index.js";

const { 原始字库 } = 获取数据();

describe("字集过滤", () => {
  const specifiers: 字集指示[] = ["minimal", "gb2312", "general", "basic", "extended", "supplement", "maximal"];
  const 汉字数量 = [6638, 6763, 8105, 21265, 101984, 103366, 110894];
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
