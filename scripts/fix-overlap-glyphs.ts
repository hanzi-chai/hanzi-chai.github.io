/**
 * 检查服务器中的所有字形数据。
 * 如果一个字形数据是复合体，operator 是重叠结构（⿻），
 * 且 references 第一项的 id 是 428，则将其替换为左中​右结构（⿲）。
 *
 * 用法：bun run scripts/fix-overlap-glyphs.ts
 * 需要设置环境变量 JWT（用于 API 认证）。
 */

import "dotenv/config";
import type { 基本字形数据, 复合体数据, 引用数据 } from "hanzi-chai";
import { createClient } from "../packages/api/src/client";

const { get, put } = createClient(() => process.env.JWT ?? null);

console.log("正在从服务器获取所有字形数据...");
const glyphs = await get<基本字形数据[]>("/glyphs");

if ("err" in glyphs) {
  console.error("获取字形列表失败:", glyphs.msg);
  process.exit(1);
}

console.log(`共获取 ${glyphs.length} 个字形数据。\n`);

const updated: 复合体数据[] = [];
for (const g of glyphs) {
  if (
    g.type === "compound" &&
    g.operator === "⿻" &&
    g.references[0]?.id === 428
  ) {
    const newReferences: 引用数据[] = [
      { id: 291 },
      ...g.references.slice(1),
      { id: 429 },
    ];
    updated.push({ ...g, operator: "⿲", references: newReferences });
  }
}

if (updated.length === 0) {
  console.log("未找到匹配的字形（复合体 + ⿻ + references[0].id === 428）。");
  process.exit(0);
}

console.log(`找到 ${updated.length} 个匹配的字形：`);
for (const g of updated) {
  console.log(`  ID: ${g.id}`);
}

console.log("\n开始更新...\n");
const res = await put<boolean>("/glyphs/batch", updated);
if (typeof res === "object" && "err" in res) {
  console.error("更新失败:", res.msg);
  process.exit(1);
}

console.log(`\n完成！`);
