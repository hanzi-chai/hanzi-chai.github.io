import { describe, it, expect } from "vitest";
import {
  字数,
  是部件或全等,
  模拟基本部件,
  模拟复合体,
  模拟拼接部件,
  模拟衍生部件,
  是基本区汉字,
  是私用区,
  解析词典
} from "../src/index.js";

describe("Unicode 方法", () => {
  it("基本区汉字判断", () => {
    const char = "字"; // Example CJK character
    expect(是基本区汉字(char)).toBeTruthy();
  });

  it("私用区判断", () => {
    const char = ""; // Example PUA character
    expect(是私用区(char)).toBeTruthy();
  });

  it("字符计数", () => {
    const s = "𠃌"; // CJK-B
    expect(字数(s)).toBe(1);
  });
});

describe("数据工具", () => {
  it("模拟", () => {
    const bc = 模拟基本部件();
    const dc = 模拟衍生部件();
    const sc = 模拟拼接部件();
    const c = 模拟复合体("⿰");
    expect(是部件或全等(bc)).toBeTruthy();
    expect(是部件或全等(dc)).toBeTruthy();
    expect(是部件或全等(sc)).toBeTruthy();
    expect(是部件或全等(c)).toBeFalsy();
  });
});

describe("其他", () => {
  it("解析词典", () => {
    const text = [["的", "de5", "100"]]; // Example TSV
    expect(解析词典(text)).toEqual([{ 词: "的", 拼音: ["de5"], 频率: 100 }]);
  });
});
