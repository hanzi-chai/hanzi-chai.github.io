/** 固定本地快照，审查基本集引用的纵向嵌套和三分结构；不写字库。 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { deflateSync } from "node:zlib";
import type { 基本字形数据, 字符数据 } from "../src/data.js";

const { values } = parseArgs({
  options: {
    "data-dir": { type: "string", default: "data" },
    out: {
      type: "string",
      default: "output/vertical-structure-audit-2026-11-14",
    },
  },
});
const out = values.out!;
mkdirSync(out, { recursive: true });
const raw = ["characters", "glyphs"].map((name) =>
  readFileSync(join(values["data-dir"]!, `${name}.json`), "utf8"),
);
const characters: 字符数据[] = JSON.parse(raw[0]!);
const glyphs: 基本字形数据[] = JSON.parse(raw[1]!);
for (const [index, name] of ["characters", "glyphs"].entries()) {
  writeFileSync(join(out, `${name}.json.deflate`), deflateSync(raw[index]!));
}
const map = new Map(glyphs.map((g) => [g.id, g]));
if (map.size !== glyphs.length) throw new Error("重复字形 ID");
const vertical = (g: 基本字形数据) =>
  g.type === "compound" && (g.operator === "⿱" || g.operator === "⿳");
const hosts = new Map<number, Set<number>>();
const direct = new Map<number, { character: string; sources: string[] }[]>();
const basic = characters.filter(
  (c) => c.unicode >= 0x4e00 && c.unicode <= 0x9fff,
);
const missing: number[] = [];
for (const c of basic) {
  const seen = new Set<number>();
  const visit = (id: number, path: Set<number>) => {
    if (path.has(id)) throw new Error(`循环引用 ${id}`);
    if (seen.has(id)) return;
    seen.add(id);
    const g = map.get(id);
    if (!g) {
      missing.push(id);
      return;
    }
    const set = hosts.get(id) ?? new Set<number>();
    set.add(c.unicode);
    hosts.set(id, set);
    for (const r of g.references ?? []) visit(r.id, new Set([...path, id]));
  };
  for (const r of c.glyphs) {
    const list = direct.get(r.id) ?? [];
    list.push({
      character: String.fromCodePoint(c.unicode),
      sources: r.sources,
    });
    direct.set(r.id, list);
    visit(r.id, new Set());
  }
}
if (missing.length) throw new Error(`缺失引用 ${[...new Set(missing)]}`);
const flattenMemo = new Map<number, number[]>();
function flatten(id: number): number[] {
  const cached = flattenMemo.get(id);
  if (cached) return cached;
  const g = map.get(id)!;
  const result = vertical(g)
    ? g.references!.flatMap((r) => flatten(r.id))
    : [id];
  flattenMemo.set(id, result);
  return result;
}
const labels = new Map<number, string>();
for (const c of characters)
  for (const r of c.glyphs) {
    if (!labels.has(r.id) || (c.unicode >= 0x4e00 && c.unicode <= 0x9fff))
      labels.set(r.id, String.fromCodePoint(c.unicode));
  }
const localNames = new Map([[957, "衣字底"]]);
const label = (id: number) =>
  `${map.get(id)?.name ?? localNames.get(id) ?? labels.get(id) ?? "分部"}(#${id.toString(16).toUpperCase().padStart(5, "0")})`;
const expr = (g: 基本字形数据) =>
  g.type === "compound"
    ? `${g.operator} ${g.references.map((r) => label(r.id)).join(" / ")}`
    : label(g.id);
const signatureMap = new Map<string, number[]>();
for (const g of glyphs)
  if (vertical(g)) {
    const key = flatten(g.id).join(",");
    const ids = signatureMap.get(key) ?? [];
    ids.push(g.id);
    signatureMap.set(key, ids);
  }
// 熵的局部差分与全库重算等价；每个 ID 等权，部件自身为唯一位置。
const structures = new Map<string, number>();
const positions = new Map<string, number>();
const f = (n: number) => (n > 0 ? n * Math.log2(n) : 0);
function counts(g: 基本字形数据) {
  const refs = g.type === "compound" ? g.references.map((r) => r.id) : [g.id];
  return {
    s: g.type === "compound" ? `${g.operator}:${refs.length}` : "component:1",
    refs,
  };
}
for (const g of glyphs) {
  const { s, refs } = counts(g);
  structures.set(s, (structures.get(s) ?? 0) + 1);
  refs.forEach((id, k) => {
    const key = `${s}:${k}:${id}`;
    positions.set(key, (positions.get(key) ?? 0) + 1);
  });
}
const n = glyphs.length;
const baseTerm =
  [...structures].reduce(
    (a, [s, count]) => a + (Number(s.split(":")[1]) - 1) * f(count),
    0,
  ) - [...positions.values()].reduce((a, count) => a + f(count), 0);
function delta(
  replacements: { id: number; operator: "⿱" | "⿳"; references: number[] }[],
) {
  const ds = new Map<string, number>(),
    dp = new Map<string, number>();
  function add(s: string, refs: number[], sign: number) {
    ds.set(s, (ds.get(s) ?? 0) + sign);
    refs.forEach((id, k) => {
      const key = `${s}:${k}:${id}`;
      dp.set(key, (dp.get(key) ?? 0) + sign);
    });
  }
  for (const r of replacements) {
    const old = counts(map.get(r.id)!);
    add(old.s, old.refs, -1);
    add(`${r.operator}:${r.references.length}`, r.references, 1);
  }
  let term = 0;
  for (const [s, d] of ds) {
    const old = structures.get(s) ?? 0;
    term += (Number(s.split(":")[1]) - 1) * (f(old + d) - f(old));
  }
  for (const [key, d] of dp) {
    const old = positions.get(key) ?? 0;
    term -= f(old + d) - f(old);
  }
  return term / n;
}
type Candidate = {
  operator: "⿱" | "⿳";
  references: number[];
  entropy_delta: number;
  expression: string;
};
type Row = {
  id: number;
  label: string;
  operator: string;
  expression: string;
  pattern: string;
  leaves: number[];
  leaf_labels: string[];
  hosts: string;
  direct: { character: string; sources: string[] }[];
  candidates: Candidate[];
  best_delta: number;
  flatten_delta: number | null;
};
const rows: Row[] = [],
  horizontal: unknown[] = [];
const flatBatch: { id: number; operator: "⿳"; references: number[] }[] = [];
const pattern = (id: number): string => {
  const g = map.get(id)!;
  return vertical(g)
    ? `${g.operator}(${g.references!.map((r) => pattern(r.id)).join(",")})`
    : "•";
};
for (const id of hosts.keys()) {
  const g = map.get(id)!;
  if (g.operator === "⿲")
    horizontal.push({
      id,
      label: label(id),
      expression: expr(g),
      hosts: [...hosts.get(id)!].map((cp) => String.fromCodePoint(cp)).join(""),
      direct: direct.get(id) ?? [],
    });
  if (
    !vertical(g) ||
    !(
      g.operator === "⿳" || g.references!.some((r) => vertical(map.get(r.id)!))
    )
  )
    continue;
  const leaves = flatten(id);
  const candidates: Candidate[] = [];
  const options = (a: number, b: number) =>
    b - a === 1
      ? [leaves[a]!]
      : (signatureMap.get(leaves.slice(a, b).join(",")) ?? []).filter(
          (x) => x !== id,
        );
  const add = (parts: number[][]) => {
    if (parts.some((p) => !p.length)) return;
    let combinations: number[][] = [[]];
    for (const part of parts)
      combinations = combinations.flatMap((prefix) =>
        part.map((x) => [...prefix, x]),
      );
    for (const references of combinations) {
      const operator = references.length === 2 ? "⿱" : "⿳";
      if (
        operator === g.operator &&
        references.every((x, k) => x === g.references![k]?.id)
      )
        continue;
      const replacement = { id, operator, references } as const;
      if (references.some((ref) => flatten(ref).includes(id)))
        throw new Error("候选引用环");
      candidates.push({
        operator,
        references,
        entropy_delta: delta([replacement]),
        expression: `${operator} ${references.map(label).join(" / ")}`,
      });
    }
  };
  for (let a = 1; a < leaves.length; a++) {
    add([options(0, a), options(a, leaves.length)]);
    for (let b = a + 1; b < leaves.length; b++)
      add([options(0, a), options(a, b), options(b, leaves.length)]);
  }
  candidates.sort((a, b) => a.entropy_delta - b.entropy_delta);
  const flatten_delta =
    leaves.length === 3
      ? delta([{ id, operator: "⿳", references: leaves }])
      : null;
  if (leaves.length === 3 && g.operator !== "⿳")
    flatBatch.push({ id, operator: "⿳", references: leaves });
  rows.push({
    id,
    label: label(id),
    operator: g.operator!,
    expression: expr(g),
    pattern: pattern(id),
    leaves,
    leaf_labels: leaves.map(label),
    hosts: [...hosts.get(id)!]
      .sort((a, b) => a - b)
      .map((cp) => String.fromCodePoint(cp))
      .join(""),
    direct: direct.get(id) ?? [],
    candidates,
    best_delta: Math.min(0, candidates[0]?.entropy_delta ?? 0),
    flatten_delta,
  });
}
rows.sort((a, b) => a.best_delta - b.best_delta);
const patterns = [...new Set(rows.map((r) => r.pattern))]
  .map((p) => ({
    pattern: p,
    count: rows.filter((r) => r.pattern === p).length,
  }))
  .sort((a, b) => b.count - a.count);
const groups = [...signatureMap]
  .filter(([, ids]) => ids.filter((id) => hosts.has(id)).length > 1)
  .map(([signature, ids]) => {
    const used = ids.filter((id) => hosts.has(id));
    const forms = new Set(used.map(pattern));
    return {
      signature,
      ids: used,
      labels: used.map(label),
      patterns: used.map(pattern),
      inconsistent: forms.size > 1,
    };
  })
  .filter((g) => g.inconsistent);
const pairs = new Map<
  string,
  { ids: Set<number>; grouped: Set<number>; split: Set<number> }
>();
for (const r of rows)
  for (let k = 0; k + 1 < r.leaves.length; k++) {
    const key = r.leaves.slice(k, k + 2).join(",");
    const family = pairs.get(key) ?? {
      ids: new Set<number>(),
      grouped: new Set<number>(),
      split: new Set<number>(),
    };
    family.ids.add(r.id);
    const g = map.get(r.id)!;
    if (g.references!.some((ref) => flatten(ref.id).join(",") === key))
      family.grouped.add(r.id);
    else family.split.add(r.id);
    pairs.set(key, family);
  }
const pairFamilies = [...pairs]
  .map(([key, v]) => ({
    leaves: key.split(",").map(Number),
    labels: key.split(",").map(Number).map(label),
    count: v.ids.size,
    grouped: [...v.grouped],
    split: [...v.split],
    ids: [...v.ids],
  }))
  .sort((a, b) => b.count - a.count);
const scenarios: {
  name: string;
  changes: { id: number; operator: "⿱" | "⿳"; references: number[] }[];
  entropy_delta: number;
}[] = [];
function scenario(
  name: string,
  changes: { id: number; operator: "⿱" | "⿳"; references: number[] }[],
) {
  scenarios.push({ name, changes, entropy_delta: delta(changes) });
}
for (const group of groups) {
  for (const templateId of group.ids) {
    const template = map.get(templateId)!;
    scenario(
      `一致性组 ${group.labels.join("、")} 统一为 ${expr(template)}`,
      group.ids
        .filter((id) => id !== templateId)
        .map((id) => ({
          id,
          operator: template.operator as "⿱" | "⿳",
          references: template.references!.map((r) => r.id),
        })),
    );
  }
}
function flattenScenario(name: string, ids: number[]) {
  scenario(
    name,
    ids.map((id) => ({ id, operator: "⿳", references: flatten(id) })),
  );
}
flattenScenario("曼两来源一起三层化", [296534, 296535]);
flattenScenario("帚现有二层写法改为三层，与另一写法一致", [205873]);
flattenScenario("鬲的 JKN 形统一为三层，保留 GHT 三层", [6247]);
scenario(
  "豆与鬲的 GHT 形同时合并一口",
  [5444, 6248].map((id) => ({
    id,
    operator: "⿱",
    references: [4638, map.get(id)!.references![2]!.id],
  })),
);
const favorableFlat = flatBatch.filter((r) => delta([r]) < 0);
scenario("32 个单独有利的三层化候选联合计算（尚未图形审核）", favorableFlat);
scenario(
  "230 个独立最优候选同时替换（尚未图形审核）",
  rows
    .filter((r) => r.best_delta < -1e-12)
    .map((r) => ({
      id: r.id,
      operator: r.candidates[0]!.operator,
      references: r.candidates[0]!.references,
    })),
);
const summary = {
  scope: "U+4E00–U+9FFF；全部来源形与递归引用；每个字形 ID 去重",
  character_count: basic.length,
  missing_characters: Array.from(
    { length: 0x5200 },
    (_, k) => k + 0x4e00,
  ).filter((cp) => !basic.some((c) => c.unicode === cp)),
  global_glyphs: n,
  used_glyphs: hosts.size,
  entropy: Math.log2(n) + baseTerm / n,
  vertical_rows: rows.length,
  nested_binary: rows.filter((r) => r.operator === "⿱").length,
  ternary: rows.filter((r) => r.operator === "⿳").length,
  nested_ternary: rows.filter((r) => r.operator === "⿳" && r.leaves.length > 3)
    .length,
  horizontal_ternary: horizontal.length,
  patterns,
  leaf_counts: Object.fromEntries(
    [...new Set(rows.map((r) => r.leaves.length))]
      .sort()
      .map((k) => [k, rows.filter((r) => r.leaves.length === k).length]),
  ),
  entropy_improvable: rows.filter((r) => r.best_delta < -1e-12).length,
  three_leaf_nested: flatBatch.length,
  flatten_individual_favorable: rows.filter(
    (r) =>
      r.operator === "⿱" && r.flatten_delta !== null && r.flatten_delta < 0,
  ).length,
  flatten_batch_delta: delta(flatBatch),
  inconsistent_signatures: groups.length,
  hashes: Object.fromEntries(
    ["characters", "glyphs"].map((name, k) => [
      name,
      createHash("sha256").update(raw[k]!).digest("hex"),
    ]),
  ),
  limitations: [
    "候选仅使用已有 ID，枚举连续纵向末级分部的二分和三分，不新增分部，不拆非纵向部件。",
    "相同末级 ID 序列只说明表示可比较，不证明布局、接点或笔顺相容；所有候选均为未通过逐项图形审核的数学预筛。",
    "熵差均以固定全库快照独立计算；不能直接相加。统一扁平化一项另用联合计数计算。",
    "同形结构一致性需人工结合实际笔形确认；连续分部二元组统计只用于定位，不自动判定应合并。",
  ],
};
writeFileSync(
  join(out, "audit.json"),
  JSON.stringify(
    {
      summary,
      rows,
      horizontal,
      consistency_groups: groups,
      pair_families: pairFamilies,
      scenarios,
    },
    null,
    2,
  ),
);
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(
  join(out, "inventory.tsv"),
  [
    "字形ID\t名称\t结构\t现状\t层数\t模式\t基本集宿主\t最优熵差\t最优候选",
    ...rows.map((r) =>
      [
        r.id,
        r.label,
        r.operator,
        r.expression,
        r.leaves.length,
        r.pattern,
        r.hosts,
        r.best_delta,
        r.candidates[0]?.expression ?? "",
      ].join("\t"),
    ),
  ].join("\n"),
);
console.log(JSON.stringify(summary, null, 2));
