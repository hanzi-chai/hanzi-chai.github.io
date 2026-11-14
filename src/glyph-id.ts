import 溢出信息 from "./glyph-id-overflow.json" with { type: "json" };

export interface 字形溢出信息 {
  radical_number: number;
  remaining_strokes: number;
  ordinal: number;
  stroke_sequence: string;
}

export const 字形溢出表: Readonly<Record<string, 字形溢出信息>> = 溢出信息;

/** 字形 ID 在数据层保存为整数；文本表示统一为五位小写十六进制。 */
export const 字形ID上限 = 0xfffff;
export const 溢出字形起点 = 0xd7000;
export const 溢出字形终点 = 0xdffff;
export const 生成字形起点 = 0xe0000;
export const 生成字形终点 = 0xeffff;
export const 自定义字形起点 = 0xf0000;
export const 自定义字形终点 = 0xfffff;

export function 是合法字形ID(id: unknown): id is number {
  return (
    typeof id === "number" &&
    Number.isInteger(id) &&
    id >= 0 &&
    id <= 字形ID上限
  );
}

export function 格式化字形ID(id: number): string {
  if (!是合法字形ID(id)) throw new Error(`字形 ID 超出范围：${id}`);
  return id.toString(16).padStart(5, "0");
}

/** 拒绝 parseInt 的部分匹配；名称中的 ID 和裸文本均按十六进制解释。 */
export function 解析字形ID(text: string): number | undefined {
  const 名称 = text.startsWith("字形-");
  const value = text.replace(/^字形-/, "").replace(/^0x/i, "");
  return (名称 ? /^[0-9a-f]{5}$/i : /^[0-9a-f]{1,5}$/i).test(value)
    ? Number.parseInt(value, 16)
    : undefined;
}

export function 获取字形ID信息(id: number) {
  const 文本 = 格式化字形ID(id);
  if (id >= 溢出字形起点) return 字形溢出表[文本];
  return {
    radical_number: id >>> 12,
    remaining_strokes: ((id >>> 8) & 15) + 1,
    ordinal: id & 255,
  };
}

export function 创建字形ID分配器(
  已占用: Iterable<number>,
  起点 = 生成字形起点,
  终点 = 生成字形终点,
): () => number {
  if (!是合法字形ID(起点) || !是合法字形ID(终点) || 起点 > 终点)
    throw new Error("字形 ID 分配范围不正确");
  const 集合 = new Set(已占用);
  let 下一个 = 起点;
  return () => {
    while (下一个 <= 终点 && 集合.has(下一个)) 下一个++;
    if (下一个 > 终点) throw new Error("字形 ID 分配区已满");
    集合.add(下一个);
    return 下一个++;
  };
}
