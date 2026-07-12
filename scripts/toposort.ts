/**
 * 从服务器拉取所有字形数据，按照引用关系进行拓扑排序。
 *
 * 排序规则：基础的在前（不被其他字形引用的），引用其他的在后。
 * 筛选规则：保留所有部件（component），以及部件可能直接或间接引用的复合体（compound）。
 *
 * 用法: bun scripts/toposort.ts
 */

import { writeFileSync } from "node:fs";
import type { 字形数据 } from "hanzi-chai";
import { listGlyphs } from "../src/api";

// ── 1. 从服务器获取所有字形数据 ──

const glyphs = await listGlyphs();
if ("err" in glyphs) {
  throw new Error(`无法从 API 获取字形数据: ${glyphs.msg}`);
}

console.log(`从服务器获取了 ${glyphs.length} 个字形`);

// ── 2. 构建引用图 ──
// 边方向: 被引用字形 → 引用字形（被引用的是前提，必须先于引用者出现）
// inDegree[G] = G 直接引用的字形数（G 有多少个前提）

const inDegree = new Map<number, number>();
const outgoing = new Map<number, Set<number>>(); // 被引用字形 → 引用它的字形集合
const references = new Map<number, Set<number>>(); // 字形 → 它引用的字形集合

for (const glyph of glyphs) {
  const refs = glyph.references ?? [];
  const refIds = new Set(refs.map((r) => r.id));
  references.set(glyph.id, refIds);
  inDegree.set(glyph.id, refIds.size);

  for (const refId of refIds) {
    if (!outgoing.has(refId)) {
      outgoing.set(refId, new Set());
    }
    outgoing.get(refId)!.add(glyph.id);
  }
}

// 确保所有字形都在 inDegree 中
for (const glyph of glyphs) {
  if (!inDegree.has(glyph.id)) {
    inDegree.set(glyph.id, 0);
  }
}

// ── 3. Kahn 算法拓扑排序 ──

const queue: number[] = [];
for (const [id, degree] of inDegree) {
  if (degree === 0) queue.push(id);
}

const sortedIds: number[] = [];
while (queue.length > 0) {
  const current = queue.shift()!;
  sortedIds.push(current);

  const dependents = outgoing.get(current);
  if (dependents) {
    for (const depId of dependents) {
      const newDegree = inDegree.get(depId)! - 1;
      inDegree.set(depId, newDegree);
      if (newDegree === 0) {
        queue.push(depId);
      }
    }
  }
}

// 处理循环引用或引用了不存在字形的节点
const unprocessed = glyphs.filter((g) => !sortedIds.includes(g.id));
if (unprocessed.length > 0) {
  console.warn(
    `\n警告: ${unprocessed.length} 个字形的引用关系无法解析（可能存在循环引用或引用了已删除的字形）`,
  );
  console.warn(`  涉及字形 ID: ${unprocessed.map((g) => g.id).join(", ")}`);
}
sortedIds.push(...unprocessed.map((g) => g.id));

// ── 4. 计算部件的传递引用闭包 ──
// 从所有部件出发，沿 references 边 DFS，得到所有可达字形

const componentIds = new Set(
  glyphs.filter((g) => g.type === "component").map((g) => g.id),
);

const reachable = new Set<number>();
const visited = new Set<number>();

function dfs(id: number) {
  if (visited.has(id)) return;
  visited.add(id);
  reachable.add(id);

  const refs = references.get(id);
  if (refs) {
    for (const refId of refs) {
      dfs(refId);
    }
  }
}

for (const compId of componentIds) {
  dfs(compId);
}

// ── 5. 筛选 ──
// 保留所有部件 + 部件可达的复合体

const glyphMap = new Map(glyphs.map((g) => [g.id, g]));
const filtered = sortedIds
  .filter((id) => {
    const glyph = glyphMap.get(id);
    if (!glyph) return false;
    if (glyph.type === "component") return true;
    // 复合体：仅保留部件可达的
    return reachable.has(id);
  })
  .map((id) => glyphMap.get(id)!);

// ── 6. 统计信息 ──

const totalComponents = glyphs.filter((g) => g.type === "component").length;
const totalCompounds = glyphs.filter((g) => g.type === "compound").length;
const reachableCompounds = [...reachable].filter(
  (id) => glyphMap.get(id)?.type === "compound",
).length;
const isolatedCompounds = totalCompounds - reachableCompounds;

console.log(`\n${"=".repeat(50)}`);
console.log(`统计信息`);
console.log(`${"=".repeat(50)}`);
console.log(`总字形数:        ${glyphs.length}`);
console.log(`  部件:          ${totalComponents}`);
console.log(`  复合体:        ${totalCompounds}`);
console.log(`部件可达字形:    ${reachable.size}`);
console.log(`  其中复合体:    ${reachableCompounds}`);
console.log(`孤立复合体:      ${isolatedCompounds}`);
console.log(`筛选后保留:      ${filtered.length}`);
console.log(`筛选掉:          ${glyphs.length - filtered.length}`);

// ── 7. 展示排序结果 ──

function formatGlyph(g: 字形数据): string {
  const type = g.type === "component" ? "部件" : "复合";
  const refs = g.references ?? [];
  const refStr =
    refs.length > 0 ? ` → [${refs.map((r) => r.id).join(", ")}]` : "";
  return `  ${type} #${g.id} (入度=${references.get(g.id)?.size ?? 0})${refStr}`;
}

console.log(`\n${"=".repeat(50)}`);
console.log(`排序结果 — 前 20 个（基础字形，没有引用其他字形）`);
console.log(`${"=".repeat(50)}`);
for (const g of filtered.slice(0, 20)) {
  console.log(formatGlyph(g));
}

console.log(`\n${"=".repeat(50)}`);
console.log(`排序结果 — 后 20 个（顶层字形，引用了许多其他字形）`);
console.log(`${"=".repeat(50)}`);
for (const g of filtered.slice(-20)) {
  console.log(formatGlyph(g));
}

// ── 8. 保存到文件 ──

const outputPath = "scripts/toposorted-glyphs.json";
writeFileSync(outputPath, JSON.stringify(filtered, null, 2));
console.log(`\n✅ 结果已保存到 ${outputPath} (${filtered.length} 个字形)`);

// 同时保存一份精简的 ID 列表，供前端导入
const idsOutputPath = "scripts/toposorted-glyph-ids.json";
writeFileSync(idsOutputPath, JSON.stringify(filtered.map((g) => g.id)));
console.log(`✅ ID 列表已保存到 ${idsOutputPath}`);