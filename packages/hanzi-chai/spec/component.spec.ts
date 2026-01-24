import { describe, expect, it } from "vitest";
import { 获取数据 } from "./index.js";

const { 原始字库, 部件图形库 } = 获取数据();

describe("pruning", () => {
  const 中 = 部件图形库.中!;
  const strokes = 4;
  const roots = [8, 4, 2, 1, 12, 6, 3, 14, 9].sort((a, b) => a - b);
  const rootsSet = new Set(roots);

  it("generate the correct set for 中", () => {
    const set = 中.生成区间和(rootsSet);
    const array = [...set].sort((a, b) => a - b);
    expect(array).toEqual([3, 6, 12, 14]);
  });

  it("generate the correct schemes for 中", () => {
    const schemes = 中.生成拆分列表(roots, new Set(roots), new Map());
    expect(schemes).toHaveLength(3);
  });
});

describe("recursive render component", () => {
  it("has nong", () => {
    const 农 = 原始字库.获取源部件("农")!;
    expect(农.ok).toBeTruthy();
  });
});
