/**
 * 检查所有 PUA（Private Use Area）码位字符的数据完整性，并可删除多余字符。
 *
 * 检查项：
 *   1. PUA 字符应当只有一个字形，报告有多个字形或无字形的异常。
 *   2. Plane 15/16 的 PUA 字符如果其唯一字形也被更小码位的字符引用，则为"多余"。
 *
 * PUA 范围：
 *   - U+E000  ~ U+F8FF   (BMP PUA,       6,400 个码位)
 *   - U+F0000 ~ U+FFFFF  (Plane 15 PUA,  65,536 个码位)
 *   - U+100000 ~ U+10FFFF (Plane 16 PUA,  65,536 个码位)
 *
 * 用法：
 *   bun run scripts/check-pua-glyphs.ts            # 仅检查
 *   bun run scripts/check-pua-glyphs.ts --delete   # 检查并删除多余的 PUA 字符
 *
 * --delete 模式需要设置环境变量 JWT（API 鉴权 token）。
 */

import "dotenv/config";
import type { 字符数据 } from "hanzi-chai";
import { listCharacters } from "../src/api";
import { del } from "./utils";

function isPUA(unicode: number): boolean {
  return (
    (unicode >= 0xe000 && unicode <= 0xf8ff) ||
    (unicode >= 0xf0000 && unicode <= 0xfffff) ||
    (unicode >= 0x100000 && unicode <= 0x10ffff)
  );
}

function formatUnicode(unicode: number): string {
  return `U+${unicode.toString(16).toUpperCase().padStart(unicode > 0xffff ? 5 : 4, "0")}`;
}

interface 多余PUA信息 {
  unicode: number;
  char: string;
  name?: string;
  glyphId: number;
  引用者列表: { unicode: number; char: string; name?: string }[];
}

async function main() {
  console.log("正在获取所有字符数据...");
  const 字符列表 = await listCharacters();
  if (!Array.isArray(字符列表)) {
    console.error("获取字符数据失败:", 字符列表);
    process.exit(1);
  }
  console.log(`共获取到 ${字符列表.length} 个字符`);

  // 过滤出 PUA 字符
  const pua字符列表 = 字符列表.filter((c) => isPUA(c.unicode));
  console.log(`其中 PUA 字符 ${pua字符列表.length} 个\n`);

  // ---- 构建字形 → 引用者映射（只考虑非 PUA 字符或更小码位的 PUA 字符） ----
  // key: glyph ID, value: 引用该字形的字符列表
  const 字形引用者映射 = new Map<number, 字符数据[]>();
  for (const 字符 of 字符列表) {
    for (const 字形来源 of 字符.glyphs) {
      const 列表 = 字形引用者映射.get(字形来源.id);
      if (列表) {
        列表.push(字符);
      } else {
        字形引用者映射.set(字形来源.id, [字符]);
      }
    }
  }

  // ============================================================
  // 检查项 1：字形数量异常
  // ============================================================

  const 多字形列表: { unicode: number; char: string; name?: string; count: number }[] = [];
  const 无字形列表: { unicode: number; char: string; name?: string }[] = [];

  for (const 字符 of pua字符列表) {
    const char = String.fromCodePoint(字符.unicode);
    const glyphCount = 字符.glyphs.length;

    if (glyphCount === 0) {
      无字形列表.push({ unicode: 字符.unicode, char, name: 字符.name });
    } else if (glyphCount > 1) {
      多字形列表.push({ unicode: 字符.unicode, char, name: 字符.name, count: glyphCount });
    }
  }

  // ============================================================
  // 检查项 2：Plane 15/16 中多余的 PUA 字符
  // ============================================================

  const 多余列表: 多余PUA信息[] = [];

  for (const pua字符 of pua字符列表) {
    // 只检查 Plane 15/16 且恰好有一个字形的 PUA 字符
    if (!isPUA(pua字符.unicode)) continue;
    if (pua字符.glyphs.length !== 1) continue;

    const glyphId = pua字符.glyphs[0]!.id;
    const 所有引用者 = 字形引用者映射.get(glyphId) ?? [];

    // 找出所有比当前 PUA 字符码位更小的引用者
    const 更小引用者 = 所有引用者.filter((c) => c.unicode < pua字符.unicode);

    if (更小引用者.length > 0) {
      多余列表.push({
        unicode: pua字符.unicode,
        char: String.fromCodePoint(pua字符.unicode),
        name: pua字符.name,
        glyphId,
        引用者列表: 更小引用者.map((c) => ({
          unicode: c.unicode,
          char: String.fromCodePoint(c.unicode),
          name: c.name,
        })),
      });
    }
  }

  // ============================================================
  // 输出结果
  // ============================================================

  let hasError = false;

  if (多字形列表.length > 0) {
    hasError = true;
    console.log(`❌ 发现 ${多字形列表.length} 个 PUA 字符有多个字形：`);
    for (const { unicode, char, name, count } of 多字形列表) {
      const namePart = name ? ` (${name})` : "";
      console.log(`  ${formatUnicode(unicode)} ${char}${namePart}：${count} 个字形`);
    }
    console.log();
  }

  if (无字形列表.length > 0) {
    console.log(`⚠️  发现 ${无字形列表.length} 个 PUA 字符没有字形：`);
    for (const { unicode, char, name } of 无字形列表) {
      const namePart = name ? ` (${name})` : "";
      console.log(`  ${formatUnicode(unicode)} ${char}${namePart}`);
    }
    console.log();
  }

  if (多余列表.length > 0) {
    hasError = true;
    console.log(`♻️  发现 ${多余列表.length} 个多余的 Plane 15/16 PUA 字符：`);
    for (const { unicode, char, name, glyphId, 引用者列表 } of 多余列表) {
      const namePart = name ? ` (${name})` : "";
      console.log(`  ${formatUnicode(unicode)} ${char}${namePart}`);
      console.log(`    字形 ID: ${glyphId}`);
      console.log(`    被以下更小码位字符引用：`);
      for (const 引用者 of 引用者列表) {
        const refName = 引用者.name ? ` (${引用者.name})` : "";
        console.log(`      ${formatUnicode(引用者.unicode)} ${引用者.char}${refName}`);
      }
    }
    console.log();
  }

  if (!hasError && 无字形列表.length === 0) {
    console.log("✅ 所有 PUA 字符均正常，没有发现多余的 PUA 字符。");
    return;
  }

  const highPuaCount = pua字符列表.filter((c) => isPUA(c.unicode)).length;
  console.log(
    `检查完毕：${pua字符列表.length} 个 PUA 字符（其中 Plane 15/16 共 ${highPuaCount} 个），` +
      `${无字形列表.length} 个无字形，${多字形列表.length} 个有多字形，${多余列表.length} 个多余。`,
  );

  // ============================================================
  // --delete：删除多余的 PUA 字符
  // ============================================================

  const shouldDelete = process.argv.includes("--delete");

  if (多余列表.length === 0) {
    if (hasError) process.exit(1);
    return;
  }

  if (!shouldDelete) {
    console.log("\n使用 --delete 参数运行以删除这些多余的 PUA 字符。");
    if (hasError) process.exit(1);
    return;
  }

  console.log(`\n正在删除 ${多余列表.length} 个多余的 PUA 字符...`);

  const unicodes = 多余列表.map((c) => c.unicode);

  try {
    const result = await del<true>("/characters", { unicodes });
    if (result === true) {
      console.log(`成功删除 ${unicodes.length} 个多余的 PUA 字符！`);
    } else {
      console.error("删除失败:", JSON.stringify(result));
      process.exit(1);
    }
  } catch (err) {
    console.error("删除异常:", (err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("执行失败:", err);
  process.exit(1);
});