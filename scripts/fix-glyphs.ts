/**
 * 检查服务器中的所有字形数据。
 *
 * 用法：bun run scripts/fix-glyphs.ts
 * 需要设置环境变量 JWT（用于 API 认证）。
 */

import "dotenv/config";
import type { 基本字形数据, 复合体数据 } from "hanzi-chai";
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
  if (g.type === "compound") {
    if (
      g.operator === "⿺" &&
      g.references[1]?.id === 189 &&
      g.strokes === undefined
    ) {
      g.references = [g.references[1], g.references[0]!];
      g.strokes = [{ index: 1 }, { index: 0 }];
      updated.push(g);
    }
  }
}

if (updated.length === 0) {
  console.log("未找到匹配的字形");
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
