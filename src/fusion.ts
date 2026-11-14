import { 部件 } from "./component.js";
import type { 分析配置 } from "./config.js";
import type { 字形 } from "./repertoire.js";

export const 默认融合字形: ReadonlySet<number> = new Set([
  869, // 光，兀跨越光字头和儿
  894, // 舌，古跨越上部和口
  910, // 兆，儿根跨越左右分部
  922, // 竒字框
  923, // 产，立跨越亠和产字底
  930, // 并
  932, // 关，䒑跨越丷和天
  964, // 克，古跨越十和兄
  1018, // 免，兔省跨越负字头和免字底
  1024, // 辛，立跨越亠和南字心
  1025, // 辛旁，立跨越亠和下部
  1026, // 养字头，䒑跨越丷和下部
  1027, // 羌，差字头跨越丷和羌字底
  1066, // 㑒，合跨越全字头和㑒字底
  1070, // 業字底，羊跨越丷和下部
  1072, // 並，䒑跨越丷和亚
  1100, // 首，䒑跨越丷和夏字头
  1102, // 彖，豕跨越彑的末横和豕省
  1106, // 衡字心，鱼跨越负字头和下部
  1116, // 毅字旁，立跨越亠和下部
  1282, // 光字框，兀跨越光字头和儿
  1283, // 克字框，古跨越十和口
  1291, // 差字头·包围外框
  4295, // 與字头，丄跨越中央竖和底横
  5222, // 交，六跨越亠和交字底
  5375, // 尞
  5714, // 𣁋字旁，兀形跨越山下的一和儿
  6476, // 卵
  7137, // 制
  7757, // 衰
  7818, // 兰，三跨越䒑和二
  11743, // 发，取根遵循交错笔顺
  14053, // 卿，卯跨越左右分部
  137564, // 台标興外框，臼根跨越两侧分部，保留中央同先写的笔顺
]);

const 空集合: ReadonlySet<number> = new Set();
const 融合部件缓存 = new WeakMap<字形, 部件>();

export function 获取融合字形集合(配置: 分析配置 = {}): ReadonlySet<number> {
  const { fusion, component_analyzer, compound_analyzer } = 配置;
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
