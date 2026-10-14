/**
 * 字符来源校验脚本：检查字形来源（sources）是否规范 + 是否与 Unihan 一致。
 *
 * 第一步：检查每个字符的各字形来源是否按 GHTJKNVMSBU 的顺序排列，
 *   且同一字符的各字形之间来源不重复。
 * 第二步：将每个字符所有字形的来源并集与 Unihan 的 kIRG_*Source 字段比对
 *   （KP 记为 N，UK 记为 B）。Unihan 中有来源的字符，来源集合须一致且每个字形
 *   都须有来源；Unihan 中没有来源的字符，不应有任何来源。
 *
 * 用法：bun run scripts/check-sources.ts
 * 需要先将 Unihan 数据放在 public/data/{VERSION}/Unihan_IRGSources.txt。
 * 只检查不修改。
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { type 字符数据, 来源排序 } from "hanzi-chai";
import { get, getLocalDataPath } from "./utils";

// ============================================================
// 工具函数
// ============================================================

const 来源替换: Record<string, string> = { KP: "N", UK: "B" };

/** 从 Unihan 读取每个码位的 IRG 来源集合。 */
function 读取Unihan来源(路径: string) {
  const 映射 = new Map<number, Set<string>>();
  for (const line of readFileSync(路径, "utf-8").split("\n")) {
    const [码位字符串, 字段] = line.split("\t");
    const 来源 = 字段?.match(/^kIRG_(\w+)Source$/)?.[1];
    if (!码位字符串?.startsWith("U+") || !来源) continue;
    const 码位 = Number.parseInt(码位字符串.slice(2), 16);
    if (!映射.has(码位)) 映射.set(码位, new Set());
    映射.get(码位)!.add(来源替换[来源] ?? 来源);
  }
  return 映射;
}

/** 按照 GHTJKNVMSBU 的顺序对来源排序，未知来源排在最后。 */
function 排序(来源: Iterable<string>) {
  const 序号 = (s: string) => {
    const i = 来源排序.indexOf(s);
    return i === -1 ? 来源排序.length : i;
  };
  return [...来源].sort((a, b) => 序号(a) - 序号(b));
}

function 格式化(码位: number) {
  const hex = 码位.toString(16).toUpperCase().padStart(5, "0");
  return `U+${hex} (${String.fromCodePoint(码位)})`;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const 期望来源映射 = 读取Unihan来源(
    `${getLocalDataPath()}/Unihan_IRGSources.txt`,
  );

  console.log("正在获取所有字符数据...");
  const 字符列表 = await get<字符数据[]>("/characters");
  if (!Array.isArray(字符列表)) {
    console.error("获取字符数据失败:", 字符列表);
    process.exit(1);
  }
  console.log(`共获取到 ${字符列表.length} 个字符\n`);

  console.log("━━━ 第一步：检查来源排序与去重 ━━━\n");
  const 问题字符列表 = 字符列表.filter(({ glyphs }) => {
    const 全部来源 = glyphs.flatMap((g) => g.sources);
    return (
      new Set(全部来源).size < 全部来源.length ||
      glyphs.some((g) => 排序(g.sources).join("") !== g.sources.join(""))
    );
  });
  console.log(`${问题字符列表.length} 个字符有问题：`);
  for (const 字符 of 问题字符列表) console.log(`  ${格式化(字符.unicode)}`);
  console.log();

  console.log("━━━ 第二步：与 Unihan 比对 ━━━\n");
  const 已有码位 = new Set(字符列表.map((c) => c.unicode));
  for (const 码位 of 期望来源映射.keys()) {
    if (!已有码位.has(码位)) console.warn(`⚠️  ${格式化(码位)} 在 API 中不存在`);
  }
  const 不匹配列表 = 字符列表
    .map((字符) => ({
      字符,
      期望: 期望来源映射.get(字符.unicode) ?? new Set<string>(),
      实际: new Set(字符.glyphs.flatMap((g) => g.sources)),
    }))
    .filter(
      ({ 字符, 期望, 实际 }) =>
        期望.symmetricDifference(实际).size > 0 ||
        (期望.size > 0 && 字符.glyphs.some((g) => g.sources.length === 0)),
    );
  console.log(`${不匹配列表.length} 个字符不匹配：`);
  for (const { 字符, 期望, 实际 } of 不匹配列表) {
    console.log(
      `  ${格式化(字符.unicode)}: 期望 [${排序(期望).join(", ")}], 实际 [${排序(实际).join(", ")}]`,
    );
  }
}

main().catch((err) => {
  console.error("执行失败:", err);
  process.exit(1);
});
