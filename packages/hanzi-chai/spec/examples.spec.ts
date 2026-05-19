import { describe, expect, it } from "vitest";
import { 获取字库, 获取字形分析结果, 获取拼音分析结果, 获取组装结果, 获取原始词典, 读取配置, 配置, 计算拼音分析与元素映射, 合并拼写运算, 获取决策与决策空间, 决策图, 计算全部合法元素与元素映射, 默认分类器 } from "../src/index.js";
import { readdirSync } from "fs";
import { 获取数据 } from "./index.js";

const { 原始字库 } = 获取数据();

describe("E2E", () => {
  const 原始词典 = 获取原始词典(undefined);
  const 词典 = 原始字库.校验词典(原始词典);
  const configs: 配置[] = [];
  for (const path of readdirSync("../../examples")) {
    if (!path.endsWith(".yaml")) {
      continue;
    }
    const 配置 = 读取配置(`../../examples/${path}`);
    configs.push(配置);
  }

  for (const 配置 of configs.slice(0, 1)) {
    it(配置.info?.name ?? "Unnamed Test", () => {
      const 字库 = 获取字库(配置);
      if (!字库.ok) {
        throw 字库.error;
      }
      const { 拼音元素映射, 拼音分析映射} = 计算拼音分析与元素映射(词典, 合并拼写运算());
      const 拼音分析 = 获取拼音分析结果(拼音分析映射, 词典);
      const 字符列表 = [...字库.value].map(({ 字符 }) => 字符);
      const { 名称映射 } = 计算全部合法元素与元素映射(
        字符列表,
        默认分类器,
        拼音元素映射,
        new Map(),
      );
      const 字形分析 = 获取字形分析结果(配置, 字库.value, 词典, 名称映射, 原始字库);
      if (!字形分析.ok) {
        throw 字形分析.error;
      }
      const { 决策, 决策空间 } = 获取决策与决策空间(配置, 字库.value, 词典, 原始字库);
      const 线性化决策 = new 决策图(决策).线性化();
      if (!线性化决策.ok) {
        throw 线性化决策.error;
      }
      const res = 获取组装结果(配置, 决策, 决策空间, 线性化决策.value, 拼音分析, 字形分析.value);
      expect(res).toBeDefined();
    });
  }
});
