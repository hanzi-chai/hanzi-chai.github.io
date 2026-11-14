import { expect, test } from "bun:test";
import { 字形归部检索 } from "../src/glyph-radical.js";
import type { 字形数据, 笔画名称 } from "../src/index.js";
import { 创建部首反查表, 康熙部首表 } from "../src/kangxi-radicals.js";

const 部件 = (id: number, feature: 笔画名称, 笔数 = 1): 字形数据 => ({
  id,
  type: "component",
  strokes: Array.from({ length: 笔数 }, () => ({
    feature,
    start: [0, 0],
    curveList: [],
  })),
});
const 复合体 = (id: number, ...ids: number[]): 字形数据 => ({
  id,
  type: "compound",
  operator: "⿰",
  references: ids.map((id) => ({ id })),
});

test("214 部首表包括偏旁形和简化形，并保留共享字形歧义", () => {
  expect(康熙部首表.map((部首) => 部首.number)).toEqual(
    Array.from({ length: 214 }, (_, i) => i + 1),
  );
  expect(康熙部首表.every((部首) => 部首.glyph_ids.length)).toBe(true);
  const 表 = 创建部首反查表();
  expect(表.get(0x00124)).toEqual([18]); // 刂
  expect(表.get(0x002ae)).toEqual([85]); // 氵
  expect(表.get(0x002f0)).toEqual([120]); // 纟
  expect(表.get(0x0017d)).toEqual([163, 170]); // 左右耳共用字形
});

test("左右耳共形按实际横向位置分别归阜、邑", () => {
  const 邑 = 康熙部首表.find((部首) => 部首.number === 163)!;
  const 阜 = 康熙部首表.find((部首) => 部首.number === 170)!;
  const 耳旁 = 邑.glyph_ids.find((id) => 阜.glyph_ids.includes(id))!;
  for (const [中点, 编号] of [
    [15, 170],
    [85, 163],
  ] as const) {
    const 字形 = 复合体(0xe0010, 耳旁, 0xf0010);
    字形.references![0] = { id: 耳旁, xbegin: 中点 - 15, xend: 中点 + 15 };
    const 检索 = new 字形归部检索([
      部件(耳旁, "竖", 2),
      部件(0xf0010, "横", 2),
      字形,
    ]);
    expect(检索.归部(字形.id).radical_numbers).toEqual([编号]);
  }
});

test("㓧的刂在第一层命中，优先于另一分部深层的口", () => {
  const 检索 = new 字形归部检索([
    部件(0x00258, "竖", 3),
    部件(0x00124, "竖", 2),
    部件(1000000, "点"),
    复合体(0x1e3f0, 0x00258, 1000000),
    复合体(0x12637, 0x1e3f0, 0x00124),
  ]);
  expect(检索.归部(0x12637)).toMatchObject({
    radical_numbers: [18],
    radical_glyph_id: 0x00124,
    remaining_strokes: 4,
    stroke_bucket: 3,
  });
});

test("部首复合体跳过自身，按子节点继续归部", () => {
  const 检索 = new 字形归部检索([
    部件(0x00105, "横", 2),
    部件(0x00198, "横撇", 2),
    复合体(0x18111, 0x00105, 0x00198),
  ]);
  expect(检索.归部(0x18111)).toMatchObject({
    radical_numbers: [24],
    remaining_strokes: 2,
  });
});

test("余笔 16 和大于 16 共用 F 桶", () => {
  for (const 余笔 of [16, 17, 68]) {
    const 检索 = new 字形归部检索([
      部件(0x00258, "横", 3),
      部件(1000000, "点", 余笔),
      复合体(1000001, 0x00258, 1000000),
    ]);
    expect(检索.归部(1000001).stroke_bucket).toBe(15);
    expect(检索.归部(1000001).remaining_strokes).toBe(余笔);
  }
});

test("无匹配部首时按首部件的首笔归部", () => {
  for (const [feature, number] of [
    ["横", 1],
    ["竖", 2],
    ["撇", 4],
    ["点", 3],
    ["横折", 5],
  ] as const) {
    const 检索 = new 字形归部检索(
      [部件(800, feature), 部件(801, "横"), 复合体(802, 800, 801)],
      [],
    );
    expect(检索.归部(802)).toMatchObject({
      radical_numbers: [number],
      fallback: true,
      remaining_strokes: 1,
    });
  }
});

test("按交错笔画块的闭区间恢复真实笔顺", () => {
  const 检索 = new 字形归部检索([
    部件(800, "横", 2),
    部件(801, "点", 2),
    {
      ...复合体(802, 800, 801),
      strokes: [
        { index: 0, from: 0, to: 0 },
        { index: 1, from: 0, to: 1 },
        { index: 0, from: 1, to: 1 },
      ],
    },
  ]);
  expect(检索.获取笔顺(802)).toBe("1441");
});

test("拒绝缺失字形和循环引用", () => {
  expect(() => new 字形归部检索([复合体(800, 800)]).归部(800)).toThrow(
    "循环引用",
  );
  expect(() => new 字形归部检索([复合体(800, 801)]).归部(800)).toThrow(
    "不存在",
  );
});
