import "dotenv/config";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createClient } from "../../packages/api/src/client";
import type {
  基本字形数据,
  字符数据,
  引用数据,
} from "../../packages/hanzi-chai/src/data";
import { UNICODE_DIR, 生成裁图, type PDFIndex } from "./unicode-pdf";

const out = resolve(
  process.argv[3] ?? "output/glyph-review/overlay-ti-migration-20261030",
);
const root = resolve(import.meta.dir, "../..");
const read = <T = any>(p: string): T =>
  JSON.parse(readFileSync(join(out, p), "utf8"));
const save = (p: string, v: unknown) => {
  writeFileSync(join(out, p) + ".tmp", JSON.stringify(v, null, 2) + "\n");
  renameSync(join(out, p) + ".tmp", join(out, p));
};
const hash = (v: string | Uint8Array) =>
  createHash("sha256").update(v).digest("hex");
const canonical = (v: any): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .filter((k) => v[k] !== undefined)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",")}}`
      : JSON.stringify(v);
const glyphs = read<基本字形数据[]>("before-glyphs.json"),
  chars = read<字符数据[]>("before-characters.json");
const map = new Map(glyphs.map((g) => [g.id, g]));
const phase = process.argv[2];
const basic = (n: number) => n >= 0x4e00 && n <= 0x9fff;
type Use = {
  unicode: number;
  character: string;
  rootId: number;
  sources: string[];
  path: number[];
};

if (phase === "inventory") {
  if (existsSync(join(out, "inventory.json")))
    throw Error("已有清单，不能覆盖");
  const index = JSON.parse(
    readFileSync(join(UNICODE_DIR, "index.json"), "utf8"),
  ) as PDFIndex;
  const uses = new Map<number, Use[]>(),
    bindings = new Map<number, any[]>();
  for (const c of chars)
    for (const r of c.glyphs) {
      const list = bindings.get(r.id) ?? [];
      list.push({
        unicode: c.unicode,
        character: String.fromCodePoint(c.unicode),
        sources: r.sources,
      });
      bindings.set(r.id, list);
    }
  function walk(id: number, use: Use, visited = new Set<number>()) {
    if (visited.has(id)) throw Error(`循环 ${id}`);
    const g = map.get(id);
    if (!g) throw Error(`缺字形 ${id}`);
    if (g.type !== "compound") return;
    if (g.operator === "⿻") {
      const list = uses.get(id) ?? [];
      list.push(use);
      uses.set(id, list);
    }
    for (const [i, r] of g.references.entries())
      walk(r.id, { ...use, path: [...use.path, i] }, new Set([...visited, id]));
  }
  for (const c of chars.filter((c) => basic(c.unicode)))
    for (const r of c.glyphs)
      walk(r.id, {
        unicode: c.unicode,
        character: String.fromCodePoint(c.unicode),
        rootId: r.id,
        sources: r.sources,
        path: [],
      });
  const items = [...uses]
    .sort(([a], [b]) => a - b)
    .map(([id, allUses], i) => {
      const examples = allUses
        .flatMap((u) =>
          u.sources.flatMap((source) => {
            const key = `${u.unicode.toString(16).toUpperCase()}-${source}`;
            return index.records[key]
              ? [{ ...u, source, key, pdf: index.records[key] }]
              : [];
          }),
        )
        .sort(
          (a, b) =>
            a.path.length - b.path.length ||
            Number(a.source !== "G") - Number(b.source !== "G") ||
            a.unicode - b.unicode,
        );
      if (!examples.length) throw Error(`缺少基本集码表实例 ${id}`);
      const g = map.get(id)!;
      return {
        index: i + 1,
        id,
        name: g.name ?? bindings.get(id)?.[0]?.character ?? `字形 ${id}`,
        bindings: bindings.get(id) ?? [],
        glyph: g,
        allUses,
        examples: [examples[0]],
        children:
          g.type === "compound"
            ? g.references.map((r) => ({
                reference: r,
                name:
                  map.get(r.id)?.name ??
                  bindings.get(r.id)?.[0]?.character ??
                  String(r.id),
                glyph: map.get(r.id),
              }))
            : [],
      };
    });
  const ti = glyphs.flatMap((g) =>
    (g.strokes ?? []).flatMap((s: any, i) =>
      s.feature?.endsWith("提")
        ? [{ id: g.id, index: i, feature: s.feature, stroke: s }]
        : [],
    ),
  );
  save("inventory.json", {
    scope:
      "CJK 基本集所有来源绑定，递归遍历全部引用中的 ⿻；按实际字形 ID 去重",
    items,
    ti,
    counts: {
      overlays: items.length,
      tiStrokes: ti.length,
      tiGlyphs: new Set(ti.map((t) => t.id)).size,
    },
  });
  const files = [
    "packages/hanzi-chai/src/affine.ts",
    "packages/hanzi-chai/src/utils.ts",
    "packages/hanzi-chai/src/layout.ts",
    "packages/hanzi-chai/src/bezier.ts",
    "packages/hanzi-chai/src/classifier.ts",
    "packages/hanzi-chai/src/enclosure.ts",
    "packages/hanzi-chai/src/enclosure-layouts.json",
    "src/components/GlyphView.tsx",
    "scripts/glyph-review/render.ts",
  ];
  const hashes: Record<string, string> = {};
  for (const f of files) {
    const dest = join(out, "renderer-snapshot", f);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(root, f), dest);
    hashes[f] = hash(readFileSync(dest));
  }
  const build = await Bun.build({
    entrypoints: [join(root, "scripts/glyph-review/render.ts")],
    outdir: join(out, "renderer-snapshot"),
    target: "bun",
    format: "esm",
    naming: "renderer.mjs",
  });
  if (!build.success) throw Error(String(build.logs));
  save("manifest.json", {
    createdAt: new Date().toISOString(),
    glyphsSha256: hash(readFileSync(join(out, "before-glyphs.json"))),
    charactersSha256: hash(readFileSync(join(out, "before-characters.json"))),
    rendererSources: hashes,
    bundleSha256: hash(
      readFileSync(join(out, "renderer-snapshot/renderer.mjs")),
    ),
    pdfSha256: index.pdfSha256,
    irgSha256: index.irgSha256,
  });
  save("crop-request.json", [
    ...new Set(items.flatMap((i) => i.examples.map((e) => e!.key))),
  ]);
  生成裁图({
    request: join(out, "crop-request.json"),
    out: join(out, "images"),
  });
  console.log(
    JSON.stringify(
      {
        overlays: items.length,
        tiStrokes: ti.length,
        examples: items
          .map(
            (i) =>
              `${i.index}:${i.id} ${i.name} → ${i.examples[0]!.character}-${i.examples[0]!.source}`,
          )
          .join("\n"),
      },
      null,
      2,
    ),
  );
}

if (phase === "render") {
  const inv = read("inventory.json");
  const decisions = existsSync(join(out, "overlay-decisions.json"))
    ? read("overlay-decisions.json")
    : [];
  const after = new Map(map);
  for (const d of decisions) {
    if (!d.references) continue;
    const g = structuredClone(map.get(d.id));
    if (g?.type !== "compound" || g.operator !== "⿻")
      throw Error(`不是叠加 ${d.id}`);
    if (
      g.references.length !== d.references.length ||
      g.references.some((r, i) => r.id !== d.references[i].id)
    )
      throw Error(`只允许调整引用参数 ${d.id}`);
    g.references = d.references;
    after.set(g.id, g);
  }
  if (process.argv[4]?.startsWith("combined"))
    for (const p of read("ti-plan.json")) {
      if (!p.topology.passed) throw Error(`提拓扑未通过 ${p.id}`);
      after.set(p.id, p.after);
    }
  const { 字形渲染器 } = await import(
    join(out, "renderer-snapshot/renderer.mjs")
  );
  const beforeRenderer = new 字形渲染器(map),
    afterRenderer = new 字形渲染器(after);
  const label = process.argv[4] ?? "before";
  const dir = join(out, label);
  if (existsSync(dir)) throw Error(`不覆盖图像 ${label}`);
  mkdirSync(join(dir, "renders"), { recursive: true });
  mkdirSync(join(dir, "panels"), { recursive: true });
  const images = new Map<string, string>(),
    evidence: any[] = [];
  const render = (id: number, which: string) => {
    const key = `${id}-${which}`;
    if (images.has(key)) return images.get(key)!;
    let svg: string, error: string | undefined;
    try {
      svg = (which === "before" ? beforeRenderer : afterRenderer).渲染(
        (which === "before" ? map : after).get(id),
      );
    } catch (e) {
      error = String(e);
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#fff0f0"/><text x="15" y="150" fill="red">Pre-existing invalid stroke blocks: ${id}</text></svg>`;
    }
    const name = `renders/${key}`;
    writeFileSync(join(dir, name + ".svg"), svg);
    const png = new Resvg(svg, { font: { loadSystemFonts: false } })
      .render()
      .asPng();
    writeFileSync(join(dir, name + ".png"), png);
    images.set(key, name + ".png");
    evidence.push({
      id,
      which,
      error,
      svgSha256: hash(svg),
      pngSha256: hash(png),
    });
    return name + ".png";
  };
  const uri = (file: string) =>
    `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  for (let p = 0; p < Math.ceil(inv.items.length / 4); p++) {
    const cells = inv.items
      .slice(p * 4, p * 4 + 4)
      .map((item: any, j: number) => {
        const e = item.examples[0];
        const source = join(out, "images", e.key + ".png");
        const a = join(dir, render(e.rootId, "before")),
          b = join(dir, render(e.rootId, "after")),
          node = join(dir, render(item.id, "after"));
        const refIds = item.glyph.references.map((r: any) => r.id).join(" + ");
        return `<g transform="translate(0,${j * 250})"><rect x="3" y="3" width="1054" height="244" fill="white" stroke="#ddd"/><text x="16" y="25" font-size="17">#${item.index} ID ${item.id} [${refIds}] / U+${e.unicode.toString(16).toUpperCase()} ${e.source} / root ${e.rootId}</text>${[source, a, b, node].map((f, k) => `<text x="${k * 265 + 35}" y="48" font-size="13">${["Unicode source", "Before whole", "After whole", "After overlay node"][k]}</text><image href="${uri(f)}" x="${k * 265 + 15}" y="55" width="235" height="185"/>`).join("")}</g>`;
      });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1060" height="${cells.length * 250}"><rect width="100%" height="100%" fill="white"/>${cells.join("")}</svg>`;
    writeFileSync(
      join(dir, "panels", `${p + 1}.png`),
      new Resvg(svg, {
        font: {
          fontFiles: ["/System/Library/Fonts/Supplemental/Arial.ttf"],
          loadSystemFonts: false,
        },
      })
        .render()
        .asPng(),
    );
  }
  save(`${label}/evidence.json`, {
    decisionsSha256: hash(canonical(decisions)),
    evidence,
  });
  console.log(
    JSON.stringify({
      label,
      panels: Math.ceil(inv.items.length / 4),
      renders: evidence.length,
    }),
  );
}
