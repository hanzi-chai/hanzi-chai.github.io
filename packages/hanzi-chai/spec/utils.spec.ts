import { describe, it, expect } from "bun:test";
import {
  模拟基本部件,
  模拟复合体,
  模拟拼接部件,
  模拟衍生部件,
  是基本或衍生部件,
  字符,
  解析原始词典
} from "../src/index.js";

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
  it("模拟函数返回正确的类型", () => {
    const bc = 模拟基本部件();
    const dc = 模拟衍生部件();
    const sc = 模拟拼接部件();
    const c = 模拟复合体("⿰");
    expect(是基本或衍生部件(bc)).toBeTruthy();
    expect(是基本或衍生部件(dc)).toBeTruthy();
    expect(是基本或衍生部件(sc)).toBeFalsy();
    expect(是基本或衍生部件(c)).toBeFalsy();
  });
});

describe("词典解析", () => {
  it("解析词典条目", () => {
    const text = [["的", "de5", "100"]];
    expect(解析原始词典(text)).toEqual([{ 词: "的", 拼音: ["de5"], 频率: 100 }]);
  });
});
