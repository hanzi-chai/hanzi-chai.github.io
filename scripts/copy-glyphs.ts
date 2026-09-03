/**
 * 复制所有引用了字形 359 的字形：把引用替换为 360 后创建为新字形。
 *
 * 用法：
 *   bun run scripts/copy-glyphs.ts --dry-run   # 仅预览，不修改
 *   bun run scripts/copy-glyphs.ts              # 执行复制
 *
 * 需要设置环境变量 JWT（用于 API 认证）。
 * 新字形的 ID 由脚本分配（部件从 64 起、复合体从 4096 起取首个空闲 ID），
 * 与服务器 POST /glyphs 的自动分配逻辑一致。
 * 如果引用 360 的等价字形已存在（排除 id、gf0014_id、gf3001_id），则跳过，
 * 因此重复运行本脚本是安全的。
 */

import "dotenv/config";
import type { 基本字形数据, 复合体数据, 字形数据 } from "hanzi-chai";
import { get, post } from "./utils";

const 源ID = 228;
const 目标ID = 437;

/** 返回字形的比较键（排除 id、gf0014_id、gf3001_id），用于判断等价字形是否已存在。 */
function 比较键(字形: 字形数据): string {
  const { id: _, gf0014_id: __, gf3001_id: ___, ...rest } = 字形;
  return JSON.stringify(rest);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("⚠️  DRY RUN 模式：只检查不修改\n");
  }

  // ─── 第 1 步：下载所有字形数据 ───
  console.log("正在下载所有字形数据...");
  const 字形列表 = await get<基本字形数据[]>("/glyphs");
  if (!Array.isArray(字形列表)) {
    console.error("获取字形数据失败:", 字形列表);
    process.exit(1);
  }
  console.log(`共获取 ${字形列表.length} 个字形。\n`);

  // ─── 第 3 步：生成副本，替换引用并分配新 ID ───
  const 已存在键集合 = new Set(字形列表.map(比较键));

  const 待创建列表: 复合体数据[] = [];
  for (const 字形 of 字形列表) {
    if (字形.type !== "compound") continue;
    if (字形.operator !== "⿱") continue;
    if (字形.references[0]?.id !== 源ID) continue;
    const 副本 = structuredClone(字形);
    副本.gf0014_id = undefined;
    副本.gf3001_id = undefined;
    副本.name = undefined;
    副本.references = 副本.references.map((ref) =>
      ref.id === 源ID ? { ...ref, id: 目标ID } : ref,
    );
    if (已存在键集合.has(比较键(副本))) {
      continue;
    }
    副本.id = 0; // 让服务器分配新 ID
    已存在键集合.add(比较键(副本));
    待创建列表.push(副本);
  }

  if (待创建列表.length === 0) {
    console.log("没有需要创建的新字形。");
    process.exit(0);
  }
  console.log(`待创建 ${待创建列表.length} 个新字形。\n`);

  for (const 副本 of 待创建列表.slice(0, 5)) {
    console.log(`  ${副本.operator} ${JSON.stringify(副本.references)}`);
  }
  if (待创建列表.length > 5) console.log("  ...\n");

  if (dryRun) {
    console.log("使用不带 --dry-run 参数运行以实际执行创建。");
    return;
  }

  // ─── 第 4 步：一次性上传 ───
  console.log("正在上传...");
  const 结果 = await post<true>("/glyphs/batch", 待创建列表);
  if (结果 !== true) {
    console.error("批量创建失败:", 结果);
    process.exit(1);
  }

  console.log(`\n✅ 全部完成！共创建 ${待创建列表.length} 个新字形。`);
}

main().catch((err) => {
  console.error("\n执行失败:", err);
  process.exit(1);
});
