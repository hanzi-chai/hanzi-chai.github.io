import { 部件 } from "./component.js";
import type { 分析配置, 数据配置 } from "./config.js";
import type { 字形 } from "./repertoire.js";

export const 默认融合字形: ReadonlySet<number> = new Set([
  0x2a210, // 光，兀跨越光字头和儿
  0x1e263, // 舌，古跨越上部和口
  0x0445f, // 兆，儿根跨越左右分部
  0x08327, // 竒字框
  0x08329, // 产，立跨越亠和产字底
  0x0341f, // 并
  0x03420, // 关，䒑跨越丷和天
  0x1840b, // 克，古跨越十和兄
  0x12439, // 免，兔省跨越负字头和免字底
  0x08421, // 辛，立跨越亠和南字心
  0x08422, // 辛旁，立跨越亠和下部
  0x03522, // 养字头，䒑跨越丷和下部
  0x03525, // 羌，差字头跨越丷和羌字底
  0x04659, // 㑒，合跨越全字头和㑒字底
  0x0361c, // 業字底，羊跨越丷和下部
  0x03626, // 並，䒑跨越丷和亚
  0x8420a, // 首，䒑跨越丷和夏字头
  0x3a51d, // 彖，豕跨越彑的末横和豕省
  0x12746, // 衡字心，鱼跨越负字头和下部
  0x0884d, // 毅字旁，立跨越亠和下部
  0x02429, // 光字框，兀跨越光字头和儿
  0x1840c, // 克字框，古跨越十和口
  0x0341d, // 差字头·包围外框
  0x019b2, // 與字头，丄跨越中央竖和底横
  0x0831f, // 交，六跨越亠和交字底
  0x48715, // 尞
  0x2e20e, // 𣁋字旁，兀形跨越山下的一和儿
  0x1a402, // 卵
  0x12522, // 制
  0x08721, // 衰
  0x03321, // 兰，三跨越䒑和二
  0x1d218, // 发，取根遵循交错笔顺
  0x1a704, // 卿，卯跨越左右分部
  0x04520, // 台标興外框，臼根跨越两侧分部，保留中央同先写的笔顺
]);

const 空集合: ReadonlySet<number> = new Set();
const 融合部件缓存 = new WeakMap<字形, 部件>();

export function 获取融合字形集合(
  分析配置: 分析配置 = {},
  数据配置: 数据配置 = {},
): ReadonlySet<number> {
  const { fusion } = 数据配置;
  const { component_analyzer, compound_analyzer } = 分析配置;
  if (Array.isArray(fusion)) return new Set(fusion);
  const 启用 =
    fusion ??
    ((component_analyzer || "默认") === "默认" &&
      (compound_analyzer || "默认") === "默认");
  return 启用 ? 默认融合字形 : 空集合;
}

export function 获取分析部件(
  字形: 字形,
  融合字形集合: ReadonlySet<number>,
): 部件 | undefined {
  if (字形 instanceof 部件) return 字形;
  if (!融合字形集合.has(字形.id)) return;
  let 部件实例 = 融合部件缓存.get(字形);
  if (部件实例 === undefined) {
    部件实例 = new 部件({
      type: "component",
      id: 字形.id,
      name: 字形.name,
      strokes: 字形.图形盒子.获取笔画列表(),
      operator: undefined,
      references: undefined,
    });
    融合部件缓存.set(字形, 部件实例);
  }
  return 部件实例;
}
