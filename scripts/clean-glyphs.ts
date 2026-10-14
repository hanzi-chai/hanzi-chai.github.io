/**
 * 字形数据清理脚本：合并重复复合体 + 删除孤立复合体。
 *
 * 第一步：找出完全相同的复合体（compound），保留 ID 最小的，将其余的通过
 *   ReplaceId 替换为最小 ID 后删除。合并后可能产生新的重复，因此反复执行直到没有重复。
 * 第二步：删除所有没有被任何字符引用、也没有被其他字形引用的孤立复合体（部件不删除）。
 *   删除后可能产生新的孤立复合体，因此反复执行直到没有孤立复合体。
 *
 * 用法：bun run scripts/clean-glyphs.ts [--dry-run]
 * 需要设置环境变量 JWT（API 鉴权 token）。
 * --dry-run 模式只检查不修改，每步只执行一轮。
 */

import "dotenv/config";
import type { 字形数据, 字符数据 } from "hanzi-chai";
import { del, get, put } from "./utils";

// ============================================================
// 工具函数
// ============================================================

/** 返回字形的比较键（排除 id、gf0014_id、gf3001_id）。 */
function 比较键(字形: 字形数据): string {
  const { id: _, gf0014_id: __, gf3001_id: ___, ...rest } = 字形;
  return JSON.stringify(rest);
}

/** 从服务端获取最新的字符和字形数据。 */
async function 获取数据() {
  console.log("正在获取字符和字形数据...");
  const 字符列表 = await get<字符数据[]>("/characters");
  const 字形列表 = await get<字形数据[]>("/glyphs");
  if (!Array.isArray(字符列表) || !Array.isArray(字形列表)) {
    console.error("获取数据失败:", 字符列表, 字形列表);
    process.exit(1);
  }
  console.log(
    `共获取到 ${字符列表.length} 个字符、${字形列表.length} 个字形\n`,
  );
  return { 字符列表, 字形列表 };
}

/** 批量删除字形，失败则退出。 */
async function 批量删除(ids: number[]) {
  const 结果 = await del<true>("/glyphs/batch", { ids });
  if (结果 !== true) {
    console.error("删除失败:", 结果);
    process.exit(1);
  }
  console.log(`成功删除 ${ids.length} 个字形。\n`);
}

// ============================================================
// 第一步：合并重复复合体
// ============================================================

/** 合并一轮重复复合体，返回是否有修改。 */
async function 合并重复复合体(字形列表: 字形数据[], dryRun: boolean) {
  const 分组 = Map.groupBy(
    字形列表.filter((g) => g.type === "compound"),
    比较键,
  );
  const 重复分组 = [...分组.values()].filter((g) => g.length > 1);

  if (重复分组.length === 0) {
    console.log("没有发现完全相同的复合体。\n");
    return false;
  }

  console.log(`发现 ${重复分组.length} 组完全相同的复合体：\n`);

  const 已替换ID列表: number[] = [];
  for (const [索引, 组] of 重复分组.entries()) {
    const [保留, ...待替换] = 组.sort((a, b) => a.id - b.id) as [
      字形数据,
      ...字形数据[],
    ];
    console.log(
      `第 ${索引 + 1} 组：保留 ${保留.id}，替换 [${待替换.map((g) => g.id).join(", ")}]`,
    );
    console.log(`  operator: ${保留.operator}`);
    console.log(`  references: ${JSON.stringify(保留.references)}`);
    if (dryRun) continue;

    for (const { id } of 待替换) {
      const 结果 = await put<true>("/glyphs", { oldId: id, newId: 保留.id });
      if (结果 === true) 已替换ID列表.push(id);
      else console.error(`  ❌ ReplaceId ${id} → ${保留.id} 失败:`, 结果);
    }
  }
  console.log();

  if (已替换ID列表.length === 0) return false;
  await 批量删除(已替换ID列表);
  return true;
}

// ============================================================
// 第二步：删除孤立复合体
// ============================================================

/** 删除一轮孤立复合体，返回是否有修改。 */
async function 删除孤立复合体(
  字符列表: 字符数据[],
  字形列表: 字形数据[],
  dryRun: boolean,
) {
  const 被引用ID集合 = new Set([
    ...字符列表.flatMap((c) => c.glyphs.map((g) => g.id)),
    ...字形列表.flatMap((g) => g.references?.map((r) => r.id) ?? []),
  ]);
  const 孤立ID列表 = 字形列表
    .filter((g) => g.type === "compound" && !被引用ID集合.has(g.id))
    .map((g) => g.id);

  if (孤立ID列表.length === 0) {
    console.log("没有发现孤立复合体。\n");
    return false;
  }

  console.log(
    `发现 ${孤立ID列表.length} 个孤立复合体：\n  IDs: ${孤立ID列表.join(", ")}\n`,
  );
  if (dryRun) return false;

  await 批量删除(孤立ID列表);
  return true;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("⚠️  DRY RUN 模式：只检查不修改\n");
  }

  // 每轮修改后重新获取数据，直到没有变化
  let 数据 = await 获取数据();

  console.log("━━━ 第一步：合并重复复合体 ━━━\n");
  while (await 合并重复复合体(数据.字形列表, dryRun)) {
    数据 = await 获取数据();
  }

  console.log("━━━ 第二步：删除孤立复合体 ━━━\n");
  while (await 删除孤立复合体(数据.字符列表, 数据.字形列表, dryRun)) {
    数据 = await 获取数据();
  }

  if (dryRun) {
    console.log("使用不带 --dry-run 参数运行以实际执行修改。");
  } else {
    console.log("全部清理完成！");
  }
}

main().catch((err) => {
  console.error("执行失败:", err);
  process.exit(1);
});
