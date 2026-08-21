/**
 * 名称转移脚本：把 characters 表中的 name 字段复制到其 glyphs 列表
 * 第一个字形（glyphs[0]）的 name 字段上。字符本身的 name 保留，不删除。
 *
 * 通过 PUT /glyphs/batch 一次性批量更新。若同一个字形被多个字符同时
 * 作为首个字形，只处理第一个字符，后面的字符忽略。
 *
 * 用法：
 *   bun run scripts/transfer-names.ts --dry-run   # 仅预览，不修改
 *   bun run scripts/transfer-names.ts              # 执行转移
 *
 * 需要设置环境变量 JWT（用于 API 认证）。
 */

import "dotenv/config";
import type { 字形数据, 字符数据 } from "hanzi-chai";
import { get, put } from "./utils";

// ============================================================
// 主流程
// ============================================================

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("⚠️  DRY RUN 模式：只检查不修改\n");
  }

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
  console.log(`共获取到 ${字形列表.length} 个字形\n`);

  const 字形映射 = new Map(字形列表.map((g) => [g.id, g]));

  const 待转移 = 字符列表.filter((c) => !!c.name);
  console.log(`其中带 name 的字符 ${待转移.length} 个\n`);

  const 已处理字形 = new Set<number>();
  const 更新列表: 字形数据[] = [];
  let 跳过数 = 0;
  let 覆盖数 = 0;
  let 冲突数 = 0;

  for (const 字符 of 待转移) {
    const 字符名 = 字符.name!;
    const 字符显示 = String.fromCodePoint(字符.unicode);
    const 首个来源 = 字符.glyphs[0];

    if (!首个来源) {
      console.warn(`⚠️  字符 ${字符显示}（${字符名}）没有 glyphs，跳过`);
      跳过数++;
      continue;
    }

    const 字形 = 字形映射.get(首个来源.id);
    if (!字形) {
      console.warn(
        `⚠️  字符 ${字符显示}（${字符名}）的首个字形 ID ${首个来源.id} 不存在，跳过`,
      );
      跳过数++;
      continue;
    }

    if (已处理字形.has(字形.id)) {
      console.warn(
        `⚠️  字形 ${字形.id} 已是其他字符的首个字形，忽略字符 ${字符显示}（${字符名}）`,
      );
      冲突数++;
      continue;
    }
    已处理字形.add(字形.id);

    if (字形.name === 字符名) {
      console.log(`✅ ${字符显示} → 字形 ${字形.id} 已是「${字符名}」，无需修改`);
      continue;
    }

    if (字形.name) {
      console.log(
        `🔄 ${字符显示} → 字形 ${字形.id}「${字形.name}」→「${字符名}」（覆盖原有名称）`,
      );
      覆盖数++;
    } else {
      console.log(`✅ ${字符显示} → 字形 ${字形.id} 设置名称「${字符名}」`);
    }

    更新列表.push({ ...字形, name: 字符名 });
  }

  console.log(
    `\n共需更新 ${更新列表.length} 个字形（覆盖 ${覆盖数}，跳过 ${跳过数}，冲突忽略 ${冲突数}）`,
  );

  if (更新列表.length === 0) {
    console.log("没有需要更新的字形。");
    return;
  }

  if (dryRun) {
    console.log("（DRY RUN：跳过实际更新）");
    console.log("使用不带 --dry-run 参数运行以实际执行修改。");
    return;
  }

  console.log("正在批量更新字形名称...");
  const 结果 = await put<true>("/glyphs/batch", 更新列表);
  if (结果 === true) {
    console.log(
      `成功批量更新 ${更新列表.length} 个字形！字符表中的 name 字段保持不变。`,
    );
  } else {
    console.error("批量更新失败:", 结果);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("执行失败:", err);
  process.exit(1);
});
