import { describe, it, expect } from "bun:test";
import { 模拟矢量笔画, 字符, 解析原始词典 } from "../src/index.js";

describe("Unicode 方法", () => {
  it("基本区汉字判断", () => {
    const char = 字符.从码位创建(0x4e00);
    expect(char.ok).toBeTruthy();
    if (char.ok) {
      expect(char.value.是基本区汉字()).toBeTruthy();
    }
  });

  it("私用区判断", () => {
    const char = 字符.从码位创建(0xe001);
    expect(char.ok).toBeTruthy();
    if (char.ok) {
      expect(char.value.是私用区()).toBeTruthy();
    }
  });
});

describe("数据工具", () => {
  it("根据笔画名称创建默认矢量笔画", () => {
    expect(模拟矢量笔画("横")).toEqual({
      feature: "横",
      start: [0, 0],
      curveList: [{ command: "h", parameterList: [20] }],
    });
    expect(模拟矢量笔画("竖", [10, 30])).toEqual({
      feature: "竖",
      start: [10, 30],
      curveList: [{ command: "v", parameterList: [20] }],
    });
  });
  it("复用命令匹配的已有笔画绘制", () => {
    const 绘制 = { command: "h" as const, parameterList: [80] as [number] };
    expect(模拟矢量笔画("横", [5, 10], [绘制]).curveList[0]).toBe(绘制);
  });
});

describe("词典解析", () => {
  it("解析词典条目", () => {
    const text = [["的", "de5", "100"]];
    expect(解析原始词典(text)).toEqual([
      { 词: "的", 拼音: ["de5"], 频率: 100 },
    ]);
  });
});
