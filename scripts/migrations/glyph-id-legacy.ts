/** 仅供历史数据和方案的显式离线迁移使用，不随运行包发布。 */
import 快照 from "./glyph-id-migration-map.json" with { type: "json" };

export function 迁移旧字形ID(id: number): number {
  if (id >= 0xf0000 && id <= 0xfffff) return id;
  let 左 = 0;
  let 右 = 快照.ranges.length - 1;
  while (左 <= 右) {
    const 中 = (左 + 右) >>> 1;
    const 段 = 快照.ranges[中]!;
    if (id < 段.start) 右 = 中 - 1;
    else if (id >= 段.start + 段.ids.length / 5) 左 = 中 + 1;
    else
      return Number.parseInt(
        段.ids.slice((id - 段.start) * 5, (id - 段.start + 1) * 5),
        16,
      );
  }
  throw new Error(`旧字形 ${id} 不在冻结的 ID 迁移映射中`);
}

let 逆映射: ReadonlyMap<number, number> | undefined;
export function 还原旧字形ID(id: number): number {
  if (!逆映射) {
    const 表 = new Map<number, number>();
    for (const 段 of 快照.ranges)
      for (let i = 0; i < 段.ids.length; i += 5)
        表.set(Number.parseInt(段.ids.slice(i, i + 5), 16), 段.start + i / 5);
    逆映射 = 表;
  }
  const 旧ID = 逆映射.get(id);
  if (旧ID === undefined)
    throw new Error(`字形 ${id.toString(16).padStart(5, "0")} 没有旧编号`);
  return 旧ID;
}
