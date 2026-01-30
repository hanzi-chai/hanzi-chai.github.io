import { describe, expect, it } from "vitest";
import { 获取字库, 获取字形分析结果, 获取拼音分析结果, 获取组装结果, 获取词典, 读取配置, 配置 } from "../src/index.js";
import { readdirSync } from "fs";

describe("E2E", () => {
  const 词典 = 获取词典();
  const configs: 配置[] = [];
  for (const path of readdirSync("../../examples")) {
    if (!path.endsWith(".yaml")) {
      continue;
    }
    const 配置 = 读取配置(`../../examples/${path}`);
    configs.push(配置);
  }

  for (const 配置 of configs) {
    it(配置.info?.name ?? "Unnamed Test", () => {
      const 字库 = 获取字库(配置);
      if (!字库.ok) {
        throw 字库.error;
      }
      const 拼音分析 = 获取拼音分析结果(配置, 词典);
      const 字形分析 = 获取字形分析结果(配置, 字库.value, 词典);
      if (!字形分析.ok) {
        throw 字形分析.error;
      }
      const res = 获取组装结果(配置, 拼音分析, 字形分析.value);
      expect(res).toBeDefined();
    });
  }
});
