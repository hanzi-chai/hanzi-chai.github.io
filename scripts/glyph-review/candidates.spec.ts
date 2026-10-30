import { describe, expect, test } from "bun:test";
import type { 基本字形数据 } from "../../packages/hanzi-chai/src/data";
import { 合并来源候选, 字形签名 } from "./candidates";

const glyph = (
  left: number,
  extra: Record<string, unknown> = {},
): 基本字形数据 =>
  ({
    id: 0,
    type: "compound",
    operator: "⿰",
    references: [{ id: left }, { id: 2 }],
    ...extra,
  }) as 基本字形数据;
const choice = (key: string, g: 基本字形数据) => ({ key, glyph: g });

describe("同字跨来源候选池", () => {
  test("其他来源的候选可供当前来源选择，只取并集而不生成新组合", () => {
    const localJ = [choice("A", glyph(1))];
    const localT = [choice("A", glyph(3)), choice("B", glyph(1))];
    const pool = 合并来源候选([
      { source: "J", candidates: localJ },
      { source: "T", candidates: localT },
    ]);
    expect(localJ.some((c) => 字形签名(c.glyph) === 字形签名(glyph(3)))).toBe(
      false,
    );
    expect(pool.map((c) => 字形签名(c.glyph))).toEqual([
      字形签名(glyph(1)),
      字形签名(glyph(3)),
    ]);
    expect(pool[0]!.poolOrigins).toEqual([
      { source: "J", key: "A" },
      { source: "T", key: "B" },
    ]);
    expect(pool[1]!.poolOrigins).toEqual([{ source: "T", key: "A" }]);
  });

  test("重复 ID 和名称不产生新候选，坐标和笔画块差异仍保留", () => {
    const plain = glyph(1);
    const sameShape = { ...plain, id: 123, name: "同形重复记录" };
    const positioned = glyph(1, {
      references: [{ id: 1, xend: 40 }, { id: 2 }],
    });
    const reordered = glyph(1, { strokes: [{ index: 1 }, { index: 0 }] });
    const groups = [
      {
        source: "J",
        candidates: [choice("A", plain), choice("B", positioned)],
      },
      {
        source: "T",
        candidates: [choice("A", sameShape), choice("B", reordered)],
      },
    ];
    const before = JSON.stringify(groups);
    const pool = 合并来源候选(groups);
    expect(pool).toHaveLength(3);
    expect(new Set(pool.map((c) => 字形签名(c.glyph))).size).toBe(3);
    expect(JSON.stringify(groups)).toBe(before);
    expect(pool[0]!.evidenceSource).toBe("J");
  });

  test("合并后不再按单来源数量截断，候选多于 26 项仍有合法唯一标签", () => {
    const pool = 合并来源候选([
      {
        source: "J",
        candidates: Array.from({ length: 20 }, (_, i) =>
          choice(`J${i}`, glyph(i + 10)),
        ),
      },
      {
        source: "T",
        candidates: Array.from({ length: 20 }, (_, i) =>
          choice(`T${i}`, glyph(i + 20)),
        ),
      },
    ]);
    expect(pool).toHaveLength(30);
    expect(pool[25]!.key).toBe("Z");
    expect(pool[26]!.key).toBe("AA");
    expect(new Set(pool.map((c) => c.key)).size).toBe(30);
  });
});
