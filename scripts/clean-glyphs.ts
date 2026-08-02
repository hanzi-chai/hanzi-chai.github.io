/**
 * 字形数据清理脚本：合并重复复合体 + 删除孤立字形。
 *
 * 第一步：找出完全相同的复合体（compound），保留 ID 最小的，将其余的通过
 *   ReplaceId 替换为最小 ID 后删除。
 * 第二步：删除所有没有被任何字符引用、也没有被其他字形引用的孤立字形。
 *
 * 用法：bun run scripts/clean-glyphs.ts [--dry-run]
 * 需要设置环境变量 JWT（API 鉴权 token）。
 * --dry-run 模式只检查不修改。
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

// ============================================================
// 第一步：合并重复复合体
// ============================================================

async function 合并重复复合体(字形列表: 字形数据[], dryRun: boolean) {
  const 复合体列表 = 字形列表.filter((g) => g.type === "compound");
  console.log(`其中复合体 ${复合体列表.length} 个`);

  // 按比较键分组
  const 分组 = new Map<string, 字形数据[]>();
  for (const 字形 of 复合体列表) {
    const key = 比较键(字形);
    const group = 分组.get(key);
    if (group) {
      group.push(字形);
    } else {
      分组.set(key, [字形]);
    }
  }

  const 重复分组 = [...分组.values()].filter((g) => g.length > 1);

  if (重复分组.length === 0) {
    console.log("没有发现完全相同的复合体。\n");
    return;
  }

  console.log(`发现 ${重复分组.length} 组完全相同的复合体：\n`);

  let 总删除数 = 0;
  let 总替换数 = 0;

  for (const [索引, 组] of 重复分组.entries()) {
    组.sort((a, b) => a.id - b.id);
    const [保留, ...待替换] = 组;
    const 待替换ID列表 = 待替换.map((g) => g.id);

    console.log(
      `第 ${索引 + 1} 组：保留 ${保留!.id}，替换 [${待替换ID列表.join(", ")}]（共 ${待替换.length} 个）`,
    );
    console.log(`  operator: ${保留!.operator}`);
    console.log(`  references: ${JSON.stringify(保留!.references)}`);

    if (!dryRun) {
      for (const 旧ID of 待替换ID列表) {
        try {
          const result = await put<true>("/glyphs", {
            oldId: 旧ID,
            newId: 保留!.id,
          });
          if (result === true) {
            console.log(`  ✅ ReplaceId ${旧ID} → ${保留!.id} 成功`);
            总替换数++;
          } else {
            console.error(`  ❌ ReplaceId ${旧ID} → ${保留!.id} 失败:`, result);
          }
        } catch (err) {
          console.error(
            `  ❌ ReplaceId ${旧ID} → ${保留!.id} 异常:`,
            (err as Error).message,
          );
        }
      }

      for (const 旧ID of 待替换ID列表) {
        try {
          const result = await del<true>(`/glyphs/${旧ID}`);
          if (result === true) {
            console.log(`  ✅ 删除旧字形 ${旧ID} 成功`);
            总删除数++;
          } else {
            console.error(`  ❌ 删除旧字形 ${旧ID} 失败:`, result);
          }
        } catch (err) {
          console.error(
            `  ❌ 删除旧字形 ${旧ID} 异常:`,
            (err as Error).message,
          );
        }
      }
    }

    console.log();
  }

  const 总涉及数 = 重复分组.reduce((sum, g) => sum + g.length - 1, 0);
  if (dryRun) {
    console.log(
      `共计 ${重复分组.length} 组重复，涉及 ${总涉及数} 个待合并复合体。\n`,
    );
  } else {
    console.log(
      `完成：${总替换数} 次 ReplaceId 替换，${总删除数} 次删除，共处理 ${重复分组.length} 组重复。\n`,
    );
  }
}

// ============================================================
// 第二步：删除孤立字形
// ============================================================

async function 删除孤立字形(
  字符列表: 字符数据[],
  字形列表: 字形数据[],
  dryRun: boolean,
) {
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

  const 孤立字形ID列表 = 字形列表
    .filter((字形) => !被引用ID集合.has(字形.id))
    .map((字形) => 字形.id);

  if (孤立字形ID列表.length === 0) {
    console.log("没有发现孤立字形，无需删除。");
    return;
  }

  console.log(
    `发现 ${孤立字形ID列表.length} 个孤立字形：\n  IDs: ${孤立字形ID列表.join(", ")}`,
  );

  if (dryRun) {
    console.log("（DRY RUN：跳过实际删除）\n");
    return;
  }

  console.log("\n正在批量删除孤立字形...");
  const 结果 = await del<true>("/glyphs", { ids: 孤立字形ID列表 });

  if (结果 === true) {
    console.log(`成功删除 ${孤立字形ID列表.length} 个孤立字形！\n`);
  } else {
    console.error("删除失败:", 结果);
    process.exit(1);
  }
}

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

  // 第一步：合并重复复合体
  console.log("━━━ 第一步：合并重复复合体 ━━━\n");
  await 合并重复复合体(字形列表, dryRun);

  // 第二步：删除孤立字形
  console.log("━━━ 第二步：删除孤立字形 ━━━\n");
  await 删除孤立字形(字符列表, 字形列表, dryRun);

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