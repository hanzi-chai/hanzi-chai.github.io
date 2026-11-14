import type { 引用数据, 结构描述字符 } from "./data.js";
import table from "./enclosure-layouts.json" with { type: "json" };

export type 包围内部范围 = Required<
  Pick<引用数据, "xbegin" | "ybegin" | "xend" | "yend">
>;
export interface 包围布局规则 {
  sourceGlyphId?: number;
  rectangle: 包围内部范围;
  rectangles?: Partial<Record<结构描述字符, 包围内部范围>>;
}

export const 包围结构列表 = [
  "⿴",
  "⿵",
  "⿶",
  "⿷",
  "⿸",
  "⿹",
  "⿺",
  "⿼",
  "⿽",
] as const;
export const 是包围结构 = (operator?: 结构描述字符) =>
  operator !== undefined &&
  (包围结构列表 as readonly string[]).includes(operator);

export const 包围内部范围表: Readonly<Record<string, 包围布局规则>> =
  table.rules;

/** 显式引用坐标仍由调用方优先采用；此表提供内件的默认范围。 */
export function 获取包围内部范围(
  outer: 引用数据 | undefined,
  operator?: 结构描述字符,
): 包围内部范围 | undefined {
  if (!outer || !是包围结构(operator)) return undefined;
  const rule = 包围内部范围表[String(outer.id)];
  if (!rule) return undefined;
  const r = rule.rectangles?.[operator!] ?? rule.rectangle;
  const xb = outer.xbegin ?? 0,
    yb = outer.ybegin ?? 0;
  const width = (outer.xend ?? 100) - xb,
    height = (outer.yend ?? 100) - yb;
  return {
    xbegin: xb + (r.xbegin * width) / 100,
    xend: xb + (r.xend * width) / 100,
    ybegin: yb + (r.ybegin * height) / 100,
    yend: yb + (r.yend * height) / 100,
  };
}
