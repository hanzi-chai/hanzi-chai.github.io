import { describe, expect, it } from "vitest";
import { 获取数据 } from "./index.js";
import { 获取字形分析结果, 获取拼音分析结果, 获取组装结果, 获取词典, 读取配置 } from "../src/index.js";

const { 字库 } = 获取数据();

describe("端到端测试", () => {
  const 米十五笔 = 读取配置("../../examples/mswb.yaml");
  const 词典 = 获取词典();
  it("米十五笔编码测试", () => {
    const 拼音分析 = 获取拼音分析结果(米十五笔, 词典);
    const 字形分析 = 获取字形分析结果(米十五笔, 字库, 词典);
    if (!字形分析.ok) {
      throw 字形分析.error;
    }
    const res = 获取组装结果(米十五笔, 拼音分析, 字形分析.value);
    expect(res).toBeDefined();
  });
});
