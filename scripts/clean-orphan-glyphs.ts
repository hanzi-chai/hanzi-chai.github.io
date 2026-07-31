/**
 * 删除所有没有被任何字符引用、也没有被其他字形引用的孤立字形。
 *
 * 用法：bun run scripts/clean-orphan-glyphs.ts
 * 需要设置环境变量 JWT（API 鉴权 token）。
 */

import "dotenv/config";
import type { 字形数据, 字符数据 } from "hanzi-chai";
import { del, get } from "./utils";

// ============================================================
// 第一步：收集所有被引用的字形 ID
// ============================================================

async function main() {
  console.log("正在获取所有字符数据...");
  const 字符列表 = await get<字符数据[]>("/characters");
  if (!Array.isArray(字符列表)) {
    console.error("获取字符数据失败:", 字符列表);
    process.exit(1);
  }
  console.log(`共获取到 ${字符列表.length} 个字符`);

  console.log("正在获取所有字形数据...");
  const 字形列表 = await get<字形数据[]>("/glyphs");
  if (!Array.isArray(字形列表)) {
    console.error("获取字形数据失败:", 字形列表);
    process.exit(1);
  }
  console.log(`共获取到 ${字形列表.length} 个字形`);

  // 收集所有被引用的字形 ID
  const 被引用ID集合 = new Set<number>();

  // 从字符的 glyphs 字段中收集
  for (const 字符 of 字符列表) {
    for (const 字形来源 of 字符.glyphs) {
      被引用ID集合.add(字形来源.id);
    }
  }
  console.log(`从字符中收集到 ${被引用ID集合.size} 个被引用字形 ID`);

  // 从字形的 references 字段中收集
  for (const 字形 of 字形列表) {
    if (!字形.references) continue;
    for (const 引用 of 字形.references) {
      被引用ID集合.add(引用.id);
    }
  }

  // ============================================================
  // 第二步：找出孤立字形
  // ============================================================

  const 孤立字形ID列表 = 字形列表
    .filter((字形) => !被引用ID集合.has(字形.id))
    .map((字形) => 字形.id);

  if (孤立字形ID列表.length === 0) {
    console.log("\n没有发现孤立字形，无需删除。");
    return;
  }

  console.log(
    `\n发现 ${孤立字形ID列表.length} 个孤立字形：\n  IDs: ${孤立字形ID列表.join(", ")}`,
  );

  // ============================================================
  // 第三步：调用 DeleteBatch 删除
  // ============================================================

  console.log("\n正在批量删除孤立字形...");
  const 结果 = await del<true>("/glyphs", { ids: 孤立字形ID列表 });

  if (结果 === true) {
    console.log(`成功删除 ${孤立字形ID列表.length} 个孤立字形！`);
  } else {
    console.error("删除失败:", 结果);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("执行失败:", err);
  process.exit(1);
});
