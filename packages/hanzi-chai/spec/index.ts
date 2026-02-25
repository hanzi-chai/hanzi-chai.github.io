import { 部件图形, 获取原始字库, 获取词典 } from "../src/index.js";

export const 获取数据 = () => {
  const 原始字库 = 获取原始字库();
  const 词典 = 获取词典();
  const 字库实例 = 原始字库.确定();
  if (!字库实例.ok) {
    console.error(字库实例.error);
    throw new Error("字库加载失败");
  }
  const 部件图形库: Record<string, 部件图形> = {};
  for (const [汉字, 数据] of Object.entries(字库实例.value._get())) {
    const glyph = 数据.glyphs[0]!;
    if (glyph.type === "basic_component") {
      部件图形库[汉字] = new 部件图形(汉字, glyph.strokes);
    }
  }
  return {
    原始字库,
    字库: 字库实例.value,
    部件图形库,
    词典,
  }
}
