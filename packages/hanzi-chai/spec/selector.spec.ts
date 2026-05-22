import { describe, expect, it, beforeAll } from "bun:test";
import {
  全符笔顺,
  决策图,
  取大优先,
  构建强类型决策与决策空间,
  根少优先,
  能散不连,
  能连不交,
  计算全部合法元素与元素映射,
  默认分类器,
  type 拆分方式,
  type 拆分环境,
  type 字形分析配置,
} from "../src/index.js";
import type { 部件 } from "../src/index.js";
import { 获取数据 } from "./index.js";

let 配置: 字形分析配置;
let 天: 部件 | undefined;
let env: 拆分环境;

const length = new 根少优先();
const bias = new 取大优先();
const order = new 全符笔顺();
const crossing = new 能连不交();
const attaching = new 能散不连();

const g = (ns: number[]): 拆分方式 => ns.map((n) => ({
  字根: env.二进制字根映射.get(n)!,
  笔画索引: 天!.二进制转索引(n),
  笔画二进制表示: n,
}));

beforeAll(() => {
  const { 字库, 部件图形库 } = 获取数据();
  const { 名称映射 } = 计算全部合法元素与元素映射([...字库].map(({ 字符 }) => 字符), 默认分类器, new Map(), new Map());
  const { 决策, 决策空间 } = 构建强类型决策与决策空间({ "1": "f", "二": "d", "人": "s", "大": "a" }, {}, 名称映射);
  const 线性化决策 = new 决策图(决策).线性化();
  if (!线性化决策.ok) throw new Error("Failed to linearize decision graph");
  const result = 字库.准备字形分析配置({}, 决策, 决策空间, 线性化决策.value, new Map(), new Map());
  if (!result.ok) throw new Error("Failed to prepare analysis config");
  配置 = result.value;
  天 = 部件图形库.天;
  env = {
    部件图形: 天!,
    二进制字根映射: new Map(),
    字根决策: new Map(),
    强字根列表: [],
    弱字根列表: [],
  };
});

describe("选择器评价", () => {
  it("根少优先", () => {
    expect(length.评价(g([8, 7]))).toEqual([2]);
  });

  it("取大优先", () => {
    expect(bias.评价(g([8, 7]))).toEqual([-1, -3]);
  });

  it("全符笔顺", () => {
    expect(order.评价(g([8, 7]))).toEqual([0]);
  });

  it("能连不交", () => {
    expect(crossing.评价(g([8, 7]), env)).toEqual([0]);
    expect(crossing.评价(g([12, 3]), env)).toEqual([1]);
  });

  it("能散不连", () => {
    expect(attaching.评价(g([8, 7]), env)).toEqual([1]);
    expect(attaching.评价(g([12, 3]), env)).toEqual([0]);
  });
});

describe("字形分析", () => {
  it("「天」选取正确的字根序列", () => {
    const a = 天!.给出部件分析(配置);
    if (!a.ok) {
      console.error(a.error);
      throw new Error("Failed to analyze 天");
    }
    const 字根序列 = a.value.字根序列;
    expect(字根序列.map(x => x.获取名称())).toEqual(["1", "大"]);
  });
});
