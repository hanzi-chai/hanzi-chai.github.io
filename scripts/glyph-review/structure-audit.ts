/** 只读分部调查：冻结本地字库，重算基本集递归复用排名，生成可检索图册。 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Resvg } from "@resvg/resvg-js";
import { 部件 } from "../../packages/hanzi-chai/src/component";
import type {
  基本字形数据,
  字符数据,
} from "../../packages/hanzi-chai/src/data";
import { 字形渲染器 } from "./render";

const { values } = parseArgs({
  options: { out: { type: "string" }, data: { type: "string" } },
});
const out = resolve(
  values.out ?? "output/glyph-review/structure-audit-20261101",
);
const data = resolve(values.data ?? "packages/hanzi-chai/src/data");
const hash = (x: string | Buffer) =>
  createHash("sha256").update(x).digest("hex");
const save = (p: string, x: unknown) =>
  writeFileSync(join(out, p), `${JSON.stringify(x, null, 2)}\n`);
mkdirSync(join(out, "snapshot"), { recursive: true });
mkdirSync(join(out, "images"), { recursive: true });
mkdirSync(join(out, "sheets"), { recursive: true });
// 同目录重跑只读已冻结输入，绝不刷新旧快照。
for (const name of ["glyphs.json", "characters.json"]) {
  const dest = join(out, "snapshot", name);
  if (!existsSync(dest)) writeFileSync(dest, readFileSync(join(data, name)));
}
const gt = readFileSync(join(out, "snapshot/glyphs.json"), "utf8");
const ct = readFileSync(join(out, "snapshot/characters.json"), "utf8");
const glyphs: 基本字形数据[] = JSON.parse(gt);
const characters: 字符数据[] = JSON.parse(ct);
const gm = new Map(glyphs.map((g) => [g.id, g]));
if (gm.size !== glyphs.length) throw Error("字形 ID 重复");
if (new Set(characters.map((c) => c.unicode)).size !== characters.length)
  throw Error("字符码位重复");
const basic = characters.filter(
  (c) => c.unicode >= 0x4e00 && c.unicode <= 0x9fff,
);
const bindings = new Map<
  number,
  { character: string; unicode: number; sources: string[] }[]
>();
for (const c of characters)
  for (const b of c.glyphs) {
    if (!bindings.has(b.id)) bindings.set(b.id, []);
    bindings.get(b.id)!.push({
      character: String.fromCodePoint(c.unicode),
      unicode: c.unicode,
      sources: b.sources,
    });
  }
function label(id: number) {
  const bb = bindings.get(id) ?? [];
  return (
    bb.find((b) => b.unicode >= 0x4e00 && b.unicode <= 0x9fff)?.character ??
    gm.get(id)?.name ??
    bb.find((b) => b.unicode < 0xf000 || b.unicode > 0xf8ff)?.character ??
    `#${id}`
  );
}
const children = new Map<number, number[]>();
const parents = new Map<number, Set<number>>();
for (const g of glyphs) {
  const refs = g.type === "compound" ? g.references.map((r) => r.id) : [];
  const raw = g as { references?: unknown[]; operator?: unknown };
  if (g.type === "component" && (raw.references?.length || raw.operator))
    throw Error(`基本部件含引用 ${g.id}`);
  children.set(g.id, refs);
  for (const id of refs) {
    if (!gm.has(id)) throw Error(`悬空引用 ${g.id}->${id}`);
    if (!parents.has(id)) parents.set(id, new Set());
    parents.get(id)!.add(g.id);
  }
}
const pending = new Map(
  glyphs.map((g) => [g.id, new Set(children.get(g.id)).size]),
);
const order = glyphs.filter((g) => pending.get(g.id) === 0).map((g) => g.id);
for (let i = 0; i < order.length; i++)
  for (const p of parents.get(order[i]!) ?? []) {
    pending.set(p, pending.get(p)! - 1);
    if (pending.get(p) === 0) order.push(p);
  }
if (order.length !== glyphs.length) throw Error("字形引用存在环");
const height = new Map<number, number>();
const features = new Map<number, string[]>();
const blockIssues: unknown[] = [];
for (const id of order) {
  const g = gm.get(id)!;
  height.set(
    id,
    Math.max(-1, ...children.get(id)!.map((x) => height.get(x)!)) + 1,
  );
  if (g.type === "component")
    features.set(
      id,
      g.strokes.map((s) => s.feature),
    );
  else {
    const parts = children.get(id)!.map((x) => features.get(x)!);
    const result: string[] = [];
    const used = parts.map((p) => p.map(() => 0));
    for (const b of g.strokes?.length
      ? g.strokes
      : parts.map((_, index) => ({ index, from: undefined, to: undefined }))) {
      const part = parts[b.index];
      if (
        !part ||
        (b.from ?? 0) < 0 ||
        (b.to ?? part.length - 1) >= part.length ||
        (b.from ?? 0) > (b.to ?? part.length - 1)
      ) {
        blockIssues.push({ id, block: b });
        continue;
      }
      for (let i = b.from ?? 0; i <= (b.to ?? part.length - 1); i++) {
        result.push(part[i]!);
        used[b.index]![i]!++;
      }
    }
    features.set(id, result);
    if (used.some((p) => p.some((x) => x !== 1)))
      blockIssues.push({ id, coverage: used });
  }
}
const roots = new Set<number>();
for (const c of basic)
  for (const b of c.glyphs) {
    if (!gm.has(b.id)) throw Error(`字符绑定不存在 ${c.unicode}->${b.id}`);
    roots.add(b.id);
  }
const reachable = new Set(roots),
  freq = new Map<number, number>();
for (const id of [...order].reverse()) {
  if (!reachable.has(id)) continue;
  const weight = (freq.get(id) ?? 0) + Number(roots.has(id));
  for (const child of children.get(id)!) {
    reachable.add(child);
    freq.set(child, (freq.get(child) ?? 0) + weight);
  }
}
const ranked = [...reachable]
  .filter((id) => freq.get(id))
  .sort(
    (a, b) =>
      freq.get(b)! - freq.get(a)! || height.get(a)! - height.get(b)! || a - b,
  );
const top = ranked.slice(0, 1000),
  selected = new Set(top);
for (const id of top)
  for (const c of children.get(id)!)
    if (!selected.has(c)) throw Error(`前1000未依赖闭合 ${id}->${c}`);
const renderer = new 字形渲染器(gm);
const renders = new Map<
  number,
  { svg: string; sha256: string; error?: string }
>();
function render(id: number) {
  if (renders.has(id)) return renders.get(id)!;
  let svg: string, error: string | undefined;
  try {
    svg = renderer.渲染(gm.get(id)!);
  } catch (e) {
    error = String(e);
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><text x="10" y="100">ERROR ${id}</text></svg>`;
  }
  const r = { svg, sha256: hash(svg), error };
  renders.set(id, r);
  writeFileSync(join(out, "images", `${id}.svg`), svg);
  return r;
}
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
function expression(id: number, depth = 0): string {
  const g = gm.get(id)!;
  return g.type === "component" || depth >= 5
    ? `${label(id)}#${id}`
    : `${g.operator}(${g.references.map((r) => expression(r.id, depth + 1)).join("，")})`;
}
const rows = top.map((id, i) => {
  const g = gm.get(id)!;
  return {
    rank: i + 1,
    id,
    label: label(id),
    name: g.name ?? "",
    type: g.type,
    frequency: freq.get(id),
    height: height.get(id),
    strokes: features.get(id)!.length,
    features: features.get(id),
    operator: g.operator ?? null,
    children: children.get(id)!,
    references: g.references ?? [],
    blocks: g.type === "compound" ? (g.strokes ?? []) : [],
    bindings: bindings.get(id) ?? [],
    expression: expression(id),
    render: render(id),
  };
});
// JSON 中不重复储存 SVG 内容。
save(
  "top-1000.json",
  rows.map(({ render: r, ...row }) => ({
    ...row,
    render: { sha256: r.sha256, error: r.error },
  })),
);
const variants = basic
  .filter(
    (c) => c.glyphs.length > 1 && c.glyphs.some((b) => selected.has(b.id)),
  )
  .map((c) => ({
    character: String.fromCodePoint(c.unicode),
    unicode: c.unicode,
    variants: [...new Set(c.glyphs.map((b) => b.id))].map((id) => ({
      id,
      selected: selected.has(id),
      type: gm.get(id)!.type,
      operator: gm.get(id)!.operator,
      frequency: freq.get(id) ?? 0,
      expression: expression(id),
      features: features.get(id),
      sources: c.glyphs.filter((b) => b.id === id).flatMap((b) => b.sources),
      render: render(id).sha256,
    })),
  }));
save("character-variants.json", variants);
const nested = rows.filter(
  (r) =>
    ["⿰", "⿱", "⿲", "⿳"].includes(r.operator ?? "") &&
    r.children.some((id) => {
      const a = gm.get(id)!;
      return (
        a.type === "compound" &&
        (r.operator === "⿰" || r.operator === "⿲"
          ? ["⿰", "⿲"]
          : ["⿱", "⿳"]
        ).includes(a.operator)
      );
    }),
);
save(
  "nested-same-axis.json",
  nested.map((r) => ({ id: r.id, rank: r.rank, expression: r.expression })),
);
const group = (xs: typeof rows, key: (r: (typeof rows)[number]) => string) =>
  Object.fromEntries(
    [...new Set(xs.map(key))].map((k) => [
      k,
      xs.filter((x) => key(x) === k).length,
    ]),
  );
const sum = (ids: number[]) => ids.reduce((n, id) => n + freq.get(id)!, 0);
const components = rows.filter((r) => r.type === "component"),
  compounds = rows.filter((r) => r.type === "compound");
const connectivity = components.map((r) => {
  const g = gm.get(r.id)!;
  if (g.type !== "component") throw Error("部件筛选失败");
  return {
    id: r.id,
    label: r.label,
    rank: r.rank,
    frequency: r.frequency,
    partitions: new 部件(g).拓扑.划分,
  };
});
save("component-connectivity.json", connectivity);
const arityIssues = compounds
  .filter(
    (r) =>
      r.children.length !==
      (["⿲", "⿳"].includes(r.operator!)
        ? 3
        : ["⿾", "⿿"].includes(r.operator!)
          ? 1
          : 2),
  )
  .map((r) => ({ id: r.id, operator: r.operator, children: r.children }));
const svgGroups = new Map<string, number[]>();
for (const [id, r] of renders) {
  if (r.error) continue;
  if (!svgGroups.has(r.sha256)) svgGroups.set(r.sha256, []);
  svgGroups.get(r.sha256)!.push(id);
}
save(
  "identical-renders.json",
  [...svgGroups]
    .filter(([, ids]) => ids.length > 1)
    .map(([sha256, ids]) => ({ sha256, ids })),
);
const summary = {
  createdAt: new Date().toISOString(),
  glyphRecords: glyphs.length,
  characterRecords: characters.length,
  basicCharacters: basic.length,
  basicRoots: roots.size,
  reachable: reachable.size,
  referenced: ranked.length,
  selected: rows.length,
  components: components.length,
  compounds: compounds.length,
  byOperator: group(compounds, (r) => r.operator!),
  byHeight: group(rows, (r) => String(r.height)),
  byStrokeCount: group(components, (r) => String(r.strokes)),
  occurrences: sum(top),
  totalOccurrences: sum(ranked),
  occurrenceCoverage: sum(top) / sum(ranked),
  boundary: rows.at(-1) && {
    id: rows.at(-1)!.id,
    frequency: rows.at(-1)!.frequency,
  },
  ties: ranked.filter((id) => freq.get(id) === freq.get(top.at(-1)!)).length,
  noBasicBinding: rows.filter(
    (r) => !r.bindings.some((b) => b.unicode >= 0x4e00 && b.unicode <= 0x9fff),
  ).length,
  explicitCoordinates: compounds.filter((r) =>
    r.references.some((x) => Object.keys(x).length > 1),
  ).length,
  explicitBlocks: compounds.filter((r) => r.blocks.length).length,
  overlayIds: compounds.filter((r) => r.operator === "⿻").map((r) => r.id),
  sameAxisNested: nested.length,
  disconnectedComponents: connectivity.filter((r) => r.partitions.length > 1)
    .length,
  ambiguousFlags: {
    components: components.filter((r) => gm.get(r.id)!.ambiguous).length,
    compounds: compounds.filter((r) => gm.get(r.id)!.ambiguous).length,
  },
  arityIssues,
  mixedTypeCharacters: variants
    .filter((v) => new Set(v.variants.map((r) => r.type)).size > 1)
    .map((v) => v.character),
  renderFailures: rows
    .filter((r) => r.render.error)
    .map((r) => ({ id: r.id, error: r.render.error })),
  selectedBlockIssues: blockIssues.filter((x: any) => selected.has(x.id)),
  graphVerified: true,
  dependencyClosureVerified: true,
  hashes: {
    glyphs: hash(gt),
    characters: hash(ct),
    script: hash(readFileSync(import.meta.filename)),
  },
};
save("summary.json", summary);
const font = "/System/Library/Fonts/STHeiti Medium.ttc";
const uri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
for (let page = 0; page < Math.ceil(rows.length / 64); page++) {
  const cells = rows
    .slice(page * 64, (page + 1) * 64)
    .map((r, index) => {
      const x = (index % 8) * 180,
        y = Math.floor(index / 8) * 183;
      return `<g transform="translate(${x},${y})"><rect width="180" height="183" fill="white" stroke="#ccc"/><text x="6" y="17" font-size="13">${r.rank}. #${r.id} ${r.type === "component" ? "部" : r.operator} ${r.frequency}</text><image x="25" y="23" width="130" height="130" href="${uri(r.render.svg)}"/><text x="8" y="173" font-size="13">${esc(r.label).slice(0, 24)}</text></g>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1464"><g font-family="PingFang SC,Arial">${cells}</g></svg>`;
  const sheet = join(out, "sheets", `${page + 1}.png`);
  // 字形与排序均由本目录快照固定；已有巡检图片保留。
  if (!existsSync(sheet))
    writeFileSync(
      sheet,
      new Resvg(svg, {
        font: {
          fontFiles: existsSync(font) ? [font] : [],
          loadSystemFonts: false,
        },
      })
        .render()
        .asPng(),
    );
}
const cards = rows
  .map(
    (r) =>
      `<article id="g${r.id}" data-text="${esc(`${r.rank} ${r.id} ${r.label} ${r.name} ${r.type} ${r.operator} ${r.expression}`)}"><h3>${r.rank}. ${esc(r.label)} #${r.id}</h3><img loading="lazy" src="images/${r.id}.svg"><p>${r.type === "component" ? "部件" : r.operator} · ${r.strokes} 笔 · ${r.frequency} 次 · 高度 ${r.height}</p><details><summary>分部、坐标与笔画块</summary><p>${esc(r.expression)}</p><pre>${esc(JSON.stringify({ references: r.references, blocks: r.blocks }, null, 2))}</pre><p>${esc(
        r.bindings
          .filter((b) => b.unicode >= 0x4e00 && b.unicode <= 0x9fff)
          .map((b) => `${b.character}[${b.sources.join(",")}]`)
          .join(" "),
      )}</p></details></article>`,
  )
  .join("\n");
writeFileSync(
  join(out, "atlas.html"),
  `<!doctype html><meta charset="utf-8"><title>基本集前1000高频字形分部调查</title><style>body{font:16px system-ui;margin:24px;background:#f5f6f8;color:#222}header{position:sticky;top:0;background:#fff;padding:12px;z-index:1}input{width:60%;font-size:18px;padding:8px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}article{background:#fff;padding:16px;border:1px solid #ddd;border-radius:8px}h3{font-size:16px}img{width:160px;height:160px}pre{white-space:pre-wrap;word-break:break-all}details{overflow-wrap:anywhere}</style><header><h1>基本集前1000高频字形分部调查</h1><p>${components.length} 部件，${compounds.length} 复合体；结构复用 ${summary.occurrenceCoverage * 100}%（并非文本字频覆盖率）。<a href="report.html">阅读分析报告</a></p><input id="q" placeholder="查字、ID、结构或 component / compound"><span id="count"></span></header><main class="grid">${cards}</main><script>q.oninput=()=>{let n=0;document.querySelectorAll('article').forEach(a=>{a.hidden=!a.dataset.text.includes(q.value.trim());if(!a.hidden)n++});count.textContent=n+' 项'};q.oninput()</script>`,
);
console.log(JSON.stringify(summary, null, 2));
