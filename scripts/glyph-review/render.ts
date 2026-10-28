import { 图形盒子 } from "../../packages/hanzi-chai/src/affine";
import type { 基本字形数据 } from "../../packages/hanzi-chai/src/data";
import { 仿射合并 } from "../../packages/hanzi-chai/src/utils";
import { 处理路径 } from "../../src/components/GlyphView";

/** 复用应用的仿射合并及笔画渲染，不构建算法分析用的拓扑。 */
export class 字形渲染器 {
  private cache = new Map<number, 图形盒子>();
  constructor(private glyphs: Map<number, 基本字形数据>) {}

  private 构建(glyph: 基本字形数据, visiting = new Set<number>()): 图形盒子 {
    if (visiting.has(glyph.id) || visiting.size > 64)
      throw new Error(`字形 ${glyph.id} 出现循环或引用过深`);
    if (glyph.type === "component") {
      if (!glyph.strokes.length) throw new Error(`字形 ${glyph.id} 没有笔画`);
      return 图形盒子.从笔画列表构建(glyph.strokes);
    }
    const next = new Set([...visiting, glyph.id]);
    const children = glyph.references.map((ref) => {
      const child = this.glyphs.get(ref.id);
      if (!child) throw new Error(`引用字形 ${ref.id} 不存在`);
      if (!this.cache.has(child.id))
        this.cache.set(child.id, this.构建(child, next));
      return this.cache.get(child.id)!;
    });
    for (const block of glyph.strokes ?? []) {
      const child = children[block.index];
      if (!child) throw new Error("笔画块引用的部分不存在");
      const count = child.获取笔画列表().length;
      if (
        (block.from ?? 0) < 0 ||
        (block.to ?? count - 1) >= count ||
        (block.from ?? 0) > (block.to ?? count - 1)
      )
        throw new Error("替换后笔画块范围越界");
    }
    return 仿射合并(children, glyph.references, glyph.operator, glyph.strokes);
  }

  渲染(glyph: 基本字形数据) {
    const strokes = this.构建(glyph).获取笔画列表();
    for (const stroke of strokes) {
      if (
        ![
          ...stroke.start,
          ...stroke.curveList.flatMap((c) => c.parameterList),
        ].every(Number.isFinite)
      )
        throw new Error("字形坐标不是有限数值");
    }
    const paths = strokes
      .map((stroke, index) => `<path d="${处理路径(stroke, index, strokes)}"/>`)
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="-5 -5 110 110"><rect x="-5" y="-5" width="110" height="110" fill="white"/><g fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
  }
}
