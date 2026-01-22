import { describe, expect, it } from "vitest";
import { 获取数据 } from ".";
import { 获取组装结果, 读取配置 } from "../src";

const { 字库 } = 获取数据();

describe("端到端测试", () => {
  const 米十五笔 = 读取配置("../../examples/mswb.yaml");
  it("米十五笔编码测试", () => {
    const res = 获取组装结果(米十五笔, 字库);
  });
});
