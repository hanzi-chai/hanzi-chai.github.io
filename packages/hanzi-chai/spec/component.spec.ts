import { describe, expect, it, beforeAll } from "bun:test";
import type { 部件 } from "../src/index.js";
import { 获取数据 } from "./index.js";

let 部件图形库: Record<string, 部件>;

beforeAll(() => {
  ({ 部件图形库 } = 获取数据());
});

describe("剪枝", () => {
  const roots = [8, 4, 2, 1, 12, 6, 3, 14, 9].sort((a, b) => a - b);
  const rootsSet = new Set(roots);
  let 中: 部件;

  beforeAll(() => {
    中 = 部件图形库.中!;
  });

  it("生成正确的区间和", () => {
    const set = 中.生成区间和(rootsSet);
    const array = [...set].sort((a, b) => a - b);
    expect(array).toEqual([3, 6, 12, 14]);
  });

  it("生成正确的拆分方案列表", () => {
    const schemes = 中.生成拆分列表(roots, new Set(roots), new Map(), true);
    expect(schemes).toHaveLength(3);
  });
});
