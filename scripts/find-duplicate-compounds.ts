/**
 * 从服务器获取所有字形数据，找出并合并完全相同的复合体（compound）。
 *
 * "完全相同"指两个复合体的 type、operator、references、strokes 全部一致
 *（id、gf0014_id、gf3001_id 字段除外）。
 *
 * 对于每组重复的复合体，保留 ID 最小的那个，将其余的通过 ReplaceId
 * 替换为最小 ID，然后删除旧记录。
 *
 * 用法：bun run scripts/find-duplicate-compounds.ts [--dry-run]
 * 需要设置环境变量 JWT（API 鉴权 token）。
 * --dry-run 模式只检查不修改。
 */

import "dotenv/config";
import type { 字形数据 } from "hanzi-chai";
import { del, get, put } from "./utils";

/**
 * 返回字形的比较键（排除 id、gf0014_id、gf3001_id）。
 * 使用 JSON 序列化确保深度比较。
 */
function 比较键(字形: 字形数据): string {
  const { id: _, gf0014_id: __, gf3001_id: ___, ...rest } = 字形;
  return JSON.stringify(rest);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("⚠️  DRY RUN 模式：只检查不修改\n");
  }

  console.log("正在获取所有字形数据...");
  const 字形列表 = await get<字形数据[]>("/glyphs");
  if (!Array.isArray(字形列表)) {
    console.error("获取字形数据失败:", 字形列表);
    process.exit(1);
  }
  console.log(`共获取到 ${字形列表.length} 个字形`);

  // 筛选出所有复合体（type === "compound"）
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

  // 找出有重复的分组（size > 1）
  const 重复分组 = [...分组.values()].filter((g) => g.length > 1);

  if (重复分组.length === 0) {
    console.log("\n没有发现完全相同的复合体。");
    return;
  }

  console.log(`\n发现 ${重复分组.length} 组完全相同的复合体：\n`);

  let 总删除数 = 0;
  let 总替换数 = 0;

  for (const [索引, 组] of 重复分组.entries()) {
    // 按 id 排序，最小的保留
    组.sort((a, b) => a.id - b.id);
    const [保留, ...待替换] = 组;
    const 待替换ID列表 = 待替换.map((g) => g.id);

    console.log(
      `第 ${索引 + 1} 组：保留 ${保留!.id}，替换 [${待替换ID列表.join(", ")}]（共 ${待替换.length} 个）`,
    );
    console.log(`  operator: ${保留!.operator}`);
    console.log(`  references: ${JSON.stringify(保留!.references)}`);

    if (!dryRun) {
      // 第一步：将所有大的 ID 替换为最小的 ID
      for (const 旧ID of 待替换ID列表) {
        try {
          const result = await put<true>("/glyphs", {
            oldId: 旧ID,
            newId: 保留!.id,
          });
          if (result === true) {
            console.log(`    ✅ ReplaceId ${旧ID} → ${保留!.id} 成功`);
            总替换数++;
          } else {
            console.error(`    ❌ ReplaceId ${旧ID} → ${保留!.id} 失败:`, result);
          }
        } catch (err) {
          console.error(
            `    ❌ ReplaceId ${旧ID} → ${保留!.id} 异常:`,
            (err as Error).message,
          );
        }
      }

      // 第二步：删除已被替换的旧字形记录
      for (const 旧ID of 待替换ID列表) {
        try {
          const result = await del<true>(`/glyphs/${旧ID}`);
          if (result === true) {
            console.log(`    ✅ 删除旧字形 ${旧ID} 成功`);
            总删除数++;
          } else {
            console.error(`    ❌ 删除旧字形 ${旧ID} 失败:`, result);
          }
        } catch (err) {
          console.error(
            `    ❌ 删除旧字形 ${旧ID} 异常:`,
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
      `共计 ${重复分组.length} 组重复，涉及 ${总涉及数} 个待合并复合体。`,
    );
    console.log("使用不带 --dry-run 参数运行以实际执行合并。");
  } else {
    console.log(
      `完成：${总替换数} 次 ReplaceId 替换，${总删除数} 次删除，共处理 ${重复分组.length} 组重复。`,
    );
  }
}

main().catch((err) => {
  console.error("执行失败:", err);
  process.exit(1);
});
