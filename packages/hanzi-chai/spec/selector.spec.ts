import { describe, expect, it } from "vitest";
import { 全符笔顺, 取大优先, 根少优先, 能散不连, 能连不交, type 拆分方式, type 拆分环境 } from "../src/index.js";
import { 获取数据 } from "./index.js";

const { 字库, 部件图形库 } = 获取数据();
const 字形分析配置 = 字库.准备字形分析配置({}, { "1": "f", "二": "d", "人": "s", "大": "a" }, {});
if (!字形分析配置.ok) {
  throw new Error("Failed to prepare analysis config");
}
const 配置 = 字形分析配置.value;
const { 天 } = 部件图形库;
const env: 拆分环境 = {
  部件图形: 天!,
  二进制字根映射: new Map(),
  分析配置: {},
  字根决策: new Map(),
};

const length = new 根少优先();
const bias = new 取大优先();
const order = new 全符笔顺();
const crossing = new 能连不交();
const attaching = new 能散不连();

const g = (ns: number[]): 拆分方式 => ns.map((n) => ({
  名称: env.二进制字根映射.get(n)!,
  笔画索引: 天!.二进制转索引(n),
  笔画二进制表示: n,
}))

describe("length", () => {
  it("should measure the length of scheme", () => {
    expect(length.评价(g([8, 7]))).toEqual([2]);
  });
});

describe("bias", () => {
  it("should measure the bias of scheme", () => {
    expect(bias.评价(g([8, 7]))).toEqual([-1, -3]);
  });
});

describe("order", () => {
  it("should measure the order of scheme", () => {
    expect(order.评价(g([8, 7]))).toEqual([0]);
  });
});

describe("crossing", () => {
  it("should measure the crossing of scheme", () => {
    expect(crossing.评价(g([8, 7]), env)).toEqual([0]);
    expect(crossing.评价(g([12, 3]), env)).toEqual([1]);
  });
});

describe("attaching", () => {
  it("should measure the attaching of scheme", () => {
    expect(attaching.评价(g([8, 7]), env)).toEqual([1]);
    expect(attaching.评价(g([12, 3]), env)).toEqual([0]);
  });
});

describe("select", () => {
  it("should select the correct scheme for 天", () => {
    const a = 天!.给出部件分析(配置);
    if (!a.ok) throw new Error("Failed to analyze 天");
    const 字根序列 = a.value.字根序列;
    expect(字根序列).toEqual(["1", "大"]);
  });
});
