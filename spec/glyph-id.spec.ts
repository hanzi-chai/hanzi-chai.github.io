import { expect, test } from "bun:test";
import type { 字形数据, 字符数据 } from "../src/data.js";
import { 创建字形ID分配器, 格式化字形ID, 解析字形ID } from "../src/glyph-id.js";
import { 应用字形ID迁移, 规划字形ID迁移 } from "../src/glyph-id-plan.js";

test("字形 ID 的五位十六进制文本无歧义，包含零与上限", () => {
  for (const id of [0, 0xabcd, 0xfffff])
    expect(解析字形ID(格式化字形ID(id))).toBe(id);
  expect(格式化字形ID(0)).toBe("00000");
  expect(解析字形ID("字形-01abc")).toBe(0x01abc);
  expect(解析字形ID("12345")).toBe(0x12345);
  expect(解析字形ID("字形-123")).toBeUndefined();
  for (const text of ["", "123xyz", "100000", "-1", " 123 "])
    expect(解析字形ID(text)).toBeUndefined();
  expect(() => 格式化字形ID(0x100000)).toThrow();
});

test("生成字形从独立生成区分配，跳过既有字形并拒绝溢出", () => {
  const 分配 = 创建字形ID分配器([0xe0000, 0xf0000]);
  expect(分配()).toBe(0xe0001);
  expect(分配()).toBe(0xe0002);
  const 满区 = 创建字形ID分配器([0xeffff], 0xeffff, 0xeffff);
  expect(() => 满区()).toThrow("已满");
});

test("同组第 257 个字形进入溢出区，保留完整排序信息", () => {
  const 字形: 字形数据[] = Array.from({ length: 257 }, (_, index) => ({
    id: index + 1,
    type: "component",
    strokes: Array.from({ length: 4 }, () => ({
      feature: "横",
      start: [1, 2],
      curveList: [{ command: "h", parameterList: [3] }],
    })),
  }));
  const 计划 = 规划字形ID迁移(字形.toReversed(), []);
  expect(计划[0]).toMatchObject({
    old_id: 1,
    id: 0x00300,
    ordinal: 0,
    overflow: false,
  });
  expect(计划[255]).toMatchObject({ old_id: 256, id: 0x003ff, ordinal: 255 });
  expect(计划[256]).toMatchObject({
    old_id: 257,
    id: 0xd7000,
    ordinal: 256,
    remaining_strokes: 4,
    overflow: true,
  });
  const 字符: 字符数据[] = [
    { unicode: 1, glyphs: [{ id: 257, sources: ["G"] }] },
  ];
  const 结果 = 应用字形ID迁移(字形, 字符, 计划);
  expect(结果.characters[0]).toEqual({
    unicode: 1,
    glyphs: [{ id: 0xd7000, sources: ["G"] }],
  });
  expect(结果.glyphs[0]!.strokes).toEqual(字形[0]!.strokes);
  expect(字形[0]!.id).toBe(1);
});
