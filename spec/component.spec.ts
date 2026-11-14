import { beforeAll, describe, expect, it } from "bun:test";
import {
  type 字库,
  type 字符,
  type 矢量笔画数据,
  部件,
  部件字根,
  默认退化配置,
} from "../src/index.js";
import { 获取数据 } from "./index.js";

let 部件图形库: Map<字符, 部件>;
let 字库实例: 字库;

beforeAll(() => {
  ({ 部件图形库, 字库: 字库实例 } = 获取数据());
});

describe("剪枝", () => {
  const roots = [8, 4, 2, 1, 12, 6, 3, 14, 9].sort((a, b) => a - b);
  const rootsSet = new Set(roots);
  let 中: 部件;

  beforeAll(() => {
    中 = 部件图形库.get(字库实例.校验字符("中")!.character)!;
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

describe("横间不穿心", () => {
  const 横 = (x: number, y: number, 长度: number): 矢量笔画数据 => ({
    feature: "横",
    start: [x, y],
    curveList: [{ command: "h", parameterList: [长度] }],
  });
  const 构建部件 = (id: number, strokes: 矢量笔画数据[]) =>
    new 部件({
      id,
      type: "component",
      operator: undefined,
      references: undefined,
      strokes,
    });
  const 配置 = { no_insert_between_heng: true };

  it("排除禹中的虫切片", () => {
    const 禹 = 部件图形库.get(字库实例.校验字符("禹")!.character)!;
    const 虫 = 字库实例.校验字符("虫")!.character;
    const 字根 = new 部件字根(虫, 部件图形库.get(虫)!);
    const 切片 = 禹.索引转二进制([1, 2, 3, 6, 7, 8]);
    expect(禹.生成新二进制切片列表(字根, 默认退化配置)).toContain(切片);
    expect(
      禹.生成新二进制切片列表(字根, { ...默认退化配置, ...配置 }),
    ).not.toContain(切片);
  });

  it.each([
    ["外笔穿心", 50, 横(20, 40, 60), false],
    ["外笔停在侧面", 50, 横(20, 40, 15), true],
    ["外笔端点相连", 50, 横(20, 40, 30), true],
    ["外笔交在两横之外", 50, 横(20, 80, 60), true],
    ["外笔交在框边", 10, 横(0, 40, 60), true],
  ] as const)("%s", (_, 中竖位置, 外笔, 保留) => {
    const 笔画: 矢量笔画数据[] = [
      横(10, 20, 80),
      {
        feature: "竖",
        start: [中竖位置, 20],
        curveList: [{ command: "v", parameterList: [70] }],
      },
      横(10, 60, 80),
    ];
    const 根部件 = 构建部件(900, 笔画);
    const 字根 = new 部件字根(根部件, 根部件);
    const 部件实例 = 构建部件(901, [...笔画, 外笔]);
    const 切片 = 部件实例.索引转二进制([0, 1, 2]);
    for (const 生成 of [
      部件实例.生成二进制切片列表,
      部件实例.生成新二进制切片列表,
    ]) {
      expect(生成.call(部件实例, 字根, {})).toContain(切片);
      expect(生成.call(部件实例, 字根, 配置).includes(切片)).toBe(保留);
    }
  });
});
