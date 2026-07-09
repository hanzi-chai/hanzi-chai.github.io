import "dotenv/config";
import { readFileSync } from "node:fs";
import type { 字符数据 } from "hanzi-chai";
import { 来源排序 } from "hanzi-chai";
import { get } from "./utils";

// ============================================================
// 第一步：从 Unihan 构建字符来源映射
// ============================================================

const 字符来源映射: Map<number, Set<string>> = new Map();
const content = readFileSync("data/Unihan_IRGSources.txt", "utf-8");
const 来源替换 = new Map([
  ["KP", "N"],
  ["UK", "B"],
]);
for (const line of content.split("\n")) {
  if (line.startsWith("#") || line.trim() === "") continue;
  const [unicode_str, 字段, value] = line.split("\t");
  const 码位 = parseInt(unicode_str.slice(2), 16);
  if (!(字段.startsWith("kIRG_") && 字段.endsWith("Source"))) continue;
  let 来源 = 字段.replace("kIRG_", "").replace("Source", "");
  if (来源替换.has(来源)) 来源 = 来源替换.get(来源)!;
  if (!字符来源映射.has(码位)) 字符来源映射.set(码位, new Set());
  字符来源映射.get(码位)!.add(来源);
}

// ============================================================
// 第二步：工具函数
// ============================================================

/** 按照 GHTJKNVMSBU 的顺序对 sources 排序 */
const orderMap = new Map(来源排序.split("").map((s, i) => [s, i]));

function sortSources(sources: string[]): string[] {
  return [...sources].sort((a, b) => {
    const ai = orderMap.get(a) ?? 来源排序.length;
    const bi = orderMap.get(b) ?? 来源排序.length;
    return ai - bi;
  });
}

function getSources(char: 字符数据): Set<string> {
  const sources = new Set<string>();
  for (const g of char.glyphs) {
    for (const s of g.sources) sources.add(s);
  }
  return sources;
}

// ============================================================
// 第三步：主流程
// ============================================================

async function main() {
  console.log("正在获取所有字符数据...");
  const 字符列表 = await get<字符数据[]>("/characters");
  if (!Array.isArray(字符列表)) {
    console.error("获取字符数据失败:", 字符列表);
    process.exit(1);
  }
  console.log(`共获取到 ${字符列表.length} 个字符\n`);

  const 问题字符列表: 字符数据[] = [];
  for (const 字符 of 字符列表) {
    let 有问题 = false;
    const 已知来源集合 = new Set<string>();

    // 排序
    for (const 字形 of 字符.glyphs) {
      const 来源列表 = 字形.sources;
      const 排序来源列表 = sortSources(字形.sources);
      if (排序来源列表.join("") !== 字形.sources.join("")) {
        有问题 = true;
      }
      const 重复来源列表 = 来源列表.filter((s) => 已知来源集合.has(s));
      if (重复来源列表.length > 0) 有问题 = true;
      for (const s of 来源列表) 已知来源集合.add(s);
    }
    if (有问题) {
      问题字符列表.push(字符);
    }
  }

  console.log(`排序与去重完成: ${问题字符列表.length} 个字符有问题：\n`);
  for (const 字符 of 问题字符列表) {
    const hex = 字符.unicode.toString(16).toUpperCase().padStart(5, "0");
    const char = String.fromCodePoint(字符.unicode);
    console.log(`  U+${hex} (${char})`);
  }

  // --- Unihan 校验 ---
  const 字符映射 = new Map<number, 字符数据>();
  for (const char of 字符列表) {
    字符映射.set(char.unicode, char);
  }

  const 不匹配列表: {
    unicode: number;
    expected: Set<string>;
    actual: Set<string>;
  }[] = [];

  for (const [码位, 来源集合] of 字符来源映射) {
    const char = 字符映射.get(码位);
    if (!char) {
      console.warn(
        `⚠️  码位 U+${码位.toString(16).toUpperCase().padStart(4, "0")} 在 API 中不存在`,
      );
      continue;
    }
    const 实际来源集合 = getSources(char);
    const missing = 来源集合.difference(实际来源集合);
    const extra = 实际来源集合.difference(来源集合);

    if (missing.size > 0 || extra.size > 0) {
      不匹配列表.push({
        unicode: 码位,
        expected: 来源集合,
        actual: 实际来源集合,
      });
    } else if (char.glyphs.some((g) => g.sources.length === 0)) {
      不匹配列表.push({
        unicode: 码位,
        expected: 来源集合,
        actual: 实际来源集合,
      });
    }
  }

  for (const 字符 of 字符列表) {
    if (字符来源映射.has(字符.unicode)) continue;
    const sources = getSources(字符);
    if (sources.size > 0) {
      不匹配列表.push({
        unicode: 字符.unicode,
        expected: new Set(),
        actual: sources,
      });
    }
  }

  console.log(`Unihan 校验: 不匹配 ${不匹配列表.length}`);

  if (不匹配列表.length > 0) {
    console.log();
    for (const { unicode, expected, actual } of 不匹配列表) {
      const hex = unicode.toString(16).toUpperCase().padStart(5, "0");
      const char = String.fromCodePoint(unicode);
      console.log(
        `  U+${hex} (${char}): 期望 [${sortSources([...expected]).join(", ")}], 实际 [${sortSources([...actual]).join(", ")}]`,
      );
    }
  }
}

main().catch((err) => {
  console.error("执行失败:", err);
  process.exit(1);
});
