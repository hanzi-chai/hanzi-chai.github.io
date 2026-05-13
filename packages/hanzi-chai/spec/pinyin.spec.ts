import { describe, expect, it } from "vitest";
import { 合并拼写运算, 字符, 计算拼音分析与元素映射, 默认拼音分析器 } from "../src/index.js";
import { 获取数据 } from "./index.js";

describe("拼音分析", () => {
  const { 词典 } = 获取数据();
  const 查找表 = 合并拼写运算();
  const { 拼音分析映射 } = 计算拼音分析与元素映射(词典, 查找表);
  const 拼音分析器 = new 默认拼音分析器(拼音分析映射);
  it("能够分析拼音", () => {
    const 有 = 字符.从码位创建(0x6709); // "有"
    if (!有.ok) throw 有.error;
    const 结果 = 拼音分析器.分析([有.value], ["you3"]);
    if (!结果.ok) throw 结果.error;
    expect(结果.value[0]!.get("韵母")).toEqual({ 类型: "韵母", 元素: "iou" });
  });
});
