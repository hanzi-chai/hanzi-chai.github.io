import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Resvg } from "@resvg/resvg-js";
import type {
  基本字形数据,
  复合体数据,
  引用数据,
  矢量笔画数据,
} from "../../packages/hanzi-chai/src/data";
import { 审计外框拓扑 } from "./enclosure-topology";
import { 字形渲染器 } from "./render";
import { type PDFIndex, UNICODE_DIR, 生成裁图 } from "./unicode-pdf";

const root = resolve(import.meta.dir, "../..");
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    ids: { type: "string" },
    combined: { type: "boolean", default: false },
  },
});
const out = resolve(values.out ?? "output/glyph-review/enclosure-profiles-18");
const read = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8"));
const write = (p: string, value: unknown) =>
  writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`);
const glyphs = read<基本字形数据[]>(
  join(root, "packages/hanzi-chai/src/data/glyphs.json"),
);
const glyphMap = new Map(glyphs.map((g) => [g.id, g]));
const inputHashes = () => {
  const digest = (p: string) =>
    createHash("sha256").update(readFileSync(p)).digest("hex");
  const index = read<PDFIndex>(join(UNICODE_DIR, "index.json"));
  return {
    glyphsSha256: digest(
      join(root, "packages/hanzi-chai/src/data/glyphs.json"),
    ),
    charactersSha256: digest(
      join(root, "packages/hanzi-chai/src/data/characters.json"),
    ),
    pdfSha256: index.pdfSha256,
    irgSha256: index.irgSha256,
  };
};
type Binding = { unicode: number; character: string; sources: string[] };
type Usage = {
  glyphId: number;
  operator: string;
  bindings: Binding[];
  references: 引用数据[];
};
type Inventory = {
  summary: unknown;
  items: {
    id: number;
    name: string;
    type: string;
    bindings: Binding[];
    basicUsageCount: number;
    allUsages: Usage[];
  }[];
};
type Example = {
  glyphId: number;
  operator: string;
  unicode: number;
  character: string;
  source: string;
  pdfKey: string;
};
type Item = {
  index: number;
  id: number;
  name: string;
  type: string;
  examples: Example[];
  operators: string[];
  basicUsageCount: number;
};
type Rect = { xbegin: number; ybegin: number; xend: number; yend: number };
type Knots = [number, number][];
type Decision = {
  id: number;
  category: 1 | 2;
  rectangle: Rect;
  rectangles?: Record<string, Rect>;
  references?: 引用数据[];
  strokes?: 矢量笔画数据[];
  auxiliaryGlyphs?: 基本字形数据[];
  contextVariants?: Record<
    string,
    { modifiedGlyph: 基本字形数据; rectangle: Rect; reason: string }
  >;
  innerVariants?: Record<
    string,
    { modifiedGlyph: 基本字形数据; rectangle: Rect; reason: string }
  >;
  innerGlyphOverrides?: Record<string, number>;
  warp?: {
    x?: Knots;
    y?: Knots;
    strokes?: { index: number; x?: Knots; y?: Knots }[];
  };
  reason: string;
  reviewedSheets: string[];
  iteration: number;
  verified?: boolean;
};
const defaults: Record<string, Rect> = {
  "⿴": { xbegin: 25, ybegin: 25, xend: 75, yend: 75 },
  "⿵": { xbegin: 25, ybegin: 40, xend: 75, yend: 90 },
  "⿶": { xbegin: 25, ybegin: 10, xend: 75, yend: 60 },
  "⿷": { xbegin: 40, ybegin: 25, xend: 90, yend: 75 },
  "⿸": { xbegin: 40, ybegin: 40, xend: 90, yend: 90 },
  "⿹": { xbegin: 10, ybegin: 40, xend: 60, yend: 90 },
  "⿺": { xbegin: 40, ybegin: 10, xend: 90, yend: 60 },
};
const font = "/System/Library/Fonts/Supplemental/Arial.ttf";
const png = (svg: string) =>
  new Resvg(svg, {
    font: {
      loadSystemFonts: !existsSync(font),
      fontFiles: existsSync(font) ? [font] : [],
      defaultFontFamily: "Arial",
    },
  })
    .render()
    .asPng();
const uri = (content: Uint8Array | string, type = "image/svg+xml") =>
  `data:${type};base64,${Buffer.from(content).toString("base64")}`;

function prepare() {
  if (existsSync(join(out, "items.json")))
    throw new Error("准备资料已存在，不覆盖");
  mkdirSync(out, { recursive: true });
  const inventory = read<Inventory>(
    join(root, "output/glyph-review/enclosure-inventory/inventory.json"),
  );
  const index = read<PDFIndex>(join(UNICODE_DIR, "index.json"));
  const preferred: Record<number, string> = {
    608: "戻房扇启",
    562: "戻房扇启",
    7132: "戻房扇",
    4206: "摩磨塺",
    127264: "摩磨塺",
    341: "床庙唐",
    71: "厅压仄",
    369: "居层凥",
    954: "赴超赲",
    359: "进远巡",
    607: "道巡",
    360: "道巡",
    132: "包句勺",
    4202: "塵麀",
    8664: "塵麀",
    866: "虎虔慮",
    475: "戒戎",
    536: "氛氧忥",
  };
  const items: Item[] = inventory.items
    .filter((i) => i.basicUsageCount > 0)
    .map((i, n) => {
      const possible = i.allUsages.flatMap((u) =>
        u.bindings
          .filter((b) => b.unicode >= 0x4e00 && b.unicode <= 0x9fff)
          .flatMap((b) => {
            const source = [...b.sources]
              .sort(
                (a, b) => "GHTJKNVMSBU".indexOf(a) - "GHTJKNVMSBU".indexOf(b),
              )
              .find(
                (s) =>
                  index.records[`${b.unicode.toString(16).toUpperCase()}-${s}`],
              );
            return source
              ? [
                  {
                    glyphId: u.glyphId,
                    operator: u.operator,
                    unicode: b.unicode,
                    character: b.character,
                    source,
                    pdfKey: `${b.unicode.toString(16).toUpperCase()}-${source}`,
                  },
                ]
              : [];
          }),
      );
      const priority = (e: Example) => {
        const p = [...(preferred[i.id] ?? "")].indexOf(e.character);
        return p < 0 ? 100000 + e.unicode : p;
      };
      possible.sort(
        (a, b) => priority(a) - priority(b) || a.glyphId - b.glyphId,
      );
      const operators = [...new Set(possible.map((e) => e.operator))];
      const examples: Example[] = [];
      for (const op of operators) {
        const candidates = possible.filter((e) => e.operator === op);
        const unique = candidates.filter(
          (e, k) => candidates.findIndex((x) => x.unicode === e.unicode) === k,
        );
        examples.push(...unique.slice(0, 2));
      }
      if (!examples.length)
        throw new Error(`外框 ${i.id} 没有可用的 Unicode 来源例子`);
      return {
        index: n + 1,
        id: i.id,
        name:
          i.name ||
          i.bindings
            .filter((b) => b.unicode >= 0x4e00 && b.unicode <= 0x9fff)
            .map((b) => b.character)
            .join(""),
        type: i.type,
        examples,
        operators,
        basicUsageCount: i.basicUsageCount,
      };
    });
  write(join(out, "items.json"), items);
  write(join(out, "inputs.json"), inputHashes());
  write(join(out, "decisions.json"), []);
  const keys = [
    ...new Set(items.flatMap((i) => i.examples.map((e) => e.pdfKey))),
  ];
  keys.sort((a, b) => index.records[a]!.page - index.records[b]!.page);
  write(join(out, "crop-request.json"), keys);
  生成裁图({
    request: join(out, "crop-request.json"),
    out: join(out, "unicode"),
  });
  console.log({
    profiles: items.length,
    examples: items.reduce((n, i) => n + i.examples.length, 0),
    crops: keys.length,
  });
}

function piecewise(value: number, knots?: Knots) {
  if (!knots?.length) return value;
  let i = 1;
  while (i < knots.length - 1 && value > knots[i]![0]) i++;
  const a = knots[i - 1]!,
    b = knots[i]!;
  return (
    Math.round(
      (a[1] + ((value - a[0]) * (b[1] - a[1])) / (b[0] - a[0])) * 100,
    ) / 100
  );
}
export function warpStroke(
  stroke: 矢量笔画数据,
  x?: Knots,
  y?: Knots,
): 矢量笔画数据 {
  let [ox, oy] = stroke.start;
  let nx = piecewise(ox, x),
    ny = piecewise(oy, y);
  const start: [number, number] = [nx, ny];
  const curveList = stroke.curveList.map((c) => {
    const p = c.parameterList;
    if (c.command === "a") throw new Error("圆弧笔画不能使用分段坐标变形");
    if (c.command === "h") {
      ox += p[0]!;
      const to = piecewise(ox, x);
      const r = { command: c.command, parameterList: [to - nx] as [number] };
      nx = to;
      return r;
    }
    if (c.command === "v") {
      oy += p[0]!;
      const to = piecewise(oy, y);
      const r = { command: c.command, parameterList: [to - ny] as [number] };
      ny = to;
      return r;
    }
    if (c.command === "l") {
      ox += p[0]!;
      oy += p[1]!;
      const tx = piecewise(ox, x),
        ty = piecewise(oy, y);
      const r = {
        command: c.command,
        parameterList: [tx - nx, ty - ny] as [number, number],
      };
      nx = tx;
      ny = ty;
      return r;
    }
    const parameterList: [number, number, number, number, number, number] = [
      piecewise(ox + p[0]!, x) - nx,
      piecewise(oy + p[1]!, y) - ny,
      piecewise(ox + p[2]!, x) - nx,
      piecewise(oy + p[3]!, y) - ny,
      piecewise(ox + p[4]!, x) - nx,
      piecewise(oy + p[5]!, y) - ny,
    ];
    ox += p[4]!;
    oy += p[5]!;
    nx += parameterList[4];
    ny += parameterList[5];
    return { command: c.command, parameterList };
  });
  return { ...stroke, start, curveList };
}
function modified(original: 基本字形数据, decision?: Decision): 基本字形数据 {
  if (!decision || decision.category === 1) return original;
  const result = structuredClone(original);
  result.id = -original.id;
  delete result.gf0014_id;
  delete result.gf3001_id;
  result.name = `${original.name ?? original.id}·包围外框`;
  if (result.type === "compound") {
    if (!decision.references)
      throw new Error(`${original.id} 的复合外框缺少引用调整`);
    result.references = decision.references;
  } else {
    if (!decision.strokes && !decision.warp)
      throw new Error(`${original.id} 的部件外框缺少笔画调整`);
    if (decision.strokes) result.strokes = decision.strokes;
    else
      result.strokes = result.strokes.map((s, i) => {
        const w = decision.warp!,
          specific = w.strokes?.find((t) => t.index === i);
        return warpStroke(s, specific?.x ?? w.x, specific?.y ?? w.y);
      });
  }
  return result;
}

function combinedGlyphs(decisions: Decision[]) {
  const decisionMap = new Map(decisions.map((d) => [d.id, d]));
  if (decisionMap.size !== decisions.length) throw new Error("重复判断 ID");
  const combinedMap = new Map(glyphMap);
  for (const d of decisions) {
    const outer = modified(glyphMap.get(d.id)!, d);
    for (const g of [
      outer,
      ...(d.auxiliaryGlyphs ?? []),
      ...Object.values(d.contextVariants ?? {}).map((v) => v.modifiedGlyph),
      ...Object.values(d.innerVariants ?? {}).map((v) => v.modifiedGlyph),
    ])
      combinedMap.set(g.id, g);
  }
  return combinedMap;
}

function render() {
  const inputs = read<ReturnType<typeof inputHashes>>(join(out, "inputs.json"));
  if (JSON.stringify(inputs) !== JSON.stringify(inputHashes()))
    throw new Error("输入数据库或码表索引发生变化，不能混用旧判断");
  const items = read<Item[]>(join(out, "items.json"));
  const decisions = read<Decision[]>(join(out, "decisions.json"));
  const decisionMap = new Map(decisions.map((d) => [d.id, d]));
  const originals = new 字形渲染器(glyphMap);
  const combinedMap = combinedGlyphs(decisions);
  // 只变换原始的正 ID。负 ID 已经明确指定布局，不能再次套默认规则。
  for (const glyph of glyphs) {
    if (glyph.type !== "compound" || !"⿴⿵⿶⿷⿸⿹⿺".includes(glyph.operator))
      continue;
    const first = glyph.references[0],
      second = glyph.references[1];
    if (!first || !second) continue;
    const d = decisionMap.get(first.id);
    if (!d) continue;
    const variant =
      d.innerVariants?.[String(second.id)] ??
      d.contextVariants?.[glyph.operator];
    const outer = variant?.modifiedGlyph ?? modified(glyphMap.get(d.id)!, d);
    const rectangle =
      variant?.rectangle ?? d.rectangles?.[glyph.operator] ?? d.rectangle;
    combinedMap.set(glyph.id, {
      ...glyph,
      references: [
        { ...first, id: outer.id },
        {
          ...second,
          id: d.innerGlyphOverrides?.[String(second.id)] ?? second.id,
          ...rectangle,
        },
      ],
    });
  }
  mkdirSync(join(out, "renders"), { recursive: true });
  mkdirSync(join(out, "sheets"), { recursive: true });
  const profiles = items.map((item) => {
    const d = decisionMap.get(item.id),
      original = glyphMap.get(item.id)!,
      outer = modified(original, d);
    const localMap = new Map(values.combined ? combinedMap : glyphMap);
    for (const auxiliary of d?.auxiliaryGlyphs ?? [])
      localMap.set(auxiliary.id, auxiliary);
    for (const variant of Object.values(d?.contextVariants ?? {}))
      localMap.set(variant.modifiedGlyph.id, variant.modifiedGlyph);
    for (const variant of Object.values(d?.innerVariants ?? {}))
      localMap.set(variant.modifiedGlyph.id, variant.modifiedGlyph);
    localMap.set(outer.id, outer);
    const renderer = new 字形渲染器(localMap);
    const alone = originals.渲染(original),
      changed = renderer.渲染(outer);
    writeFileSync(join(out, "renders", `${item.id}-original.svg`), alone);
    writeFileSync(join(out, "renders", `${item.id}-outer.svg`), changed);
    const examples = item.examples.map((example, n) => {
      const glyph = glyphMap.get(example.glyphId)! as 复合体数据;
      const variant =
        d?.innerVariants?.[String(glyph.references[1]!.id)] ??
        d?.contextVariants?.[example.operator];
      const exampleOuter = variant?.modifiedGlyph ?? outer;
      const rectangle =
        variant?.rectangle ??
        d?.rectangles?.[example.operator] ??
        d?.rectangle ??
        defaults[example.operator]!;
      const adjusted: 复合体数据 = {
        ...glyph,
        id: -200000 - glyph.id,
        references: [
          { ...glyph.references[0]!, id: exampleOuter.id },
          {
            ...glyph.references[1]!,
            id:
              d?.innerGlyphOverrides?.[String(glyph.references[1]!.id)] ??
              glyph.references[1]!.id,
            ...rectangle,
          },
        ],
      };
      const before = originals.渲染(glyph),
        after = renderer.渲染(adjusted);
      const grid = [...Array(11)]
        .map(
          (_, i) =>
            `<path d="M${i * 10} 0V100M0 ${i * 10}H100" stroke="#dde5ee" stroke-width="0.25"/>`,
        )
        .join("");
      const overlay = renderer
        .渲染(exampleOuter)
        .replace(
          '<g fill="none"',
          `${grid}<rect x="${rectangle.xbegin}" y="${rectangle.ybegin}" width="${rectangle.xend - rectangle.xbegin}" height="${rectangle.yend - rectangle.ybegin}" fill="#48a66b" fill-opacity="0.08" stroke="#299456" stroke-width="0.8"/><g fill="none"`,
        );
      for (const [kind, svg] of Object.entries({
        before,
        after,
        frame: overlay,
      }))
        writeFileSync(join(out, "renders", `${item.id}-${n}-${kind}.svg`), svg);
      return {
        ...example,
        rectangle,
        before: `renders/${item.id}-${n}-before.svg`,
        after: `renders/${item.id}-${n}-after.svg`,
        frame: `renders/${item.id}-${n}-frame.svg`,
      };
    });
    return {
      ...item,
      category: d?.category ?? null,
      rectangle: d?.rectangle ?? null,
      rectangles: d?.rectangles,
      modifiedGlyph: d?.category === 2 ? outer : null,
      auxiliaryGlyphs: (d?.auxiliaryGlyphs ?? []).map((g) => {
        const copy = structuredClone(g);
        delete copy.gf0014_id;
        delete copy.gf3001_id;
        return copy;
      }),
      contextVariants: d?.contextVariants,
      innerVariants: d?.innerVariants,
      innerGlyphOverrides: d?.innerGlyphOverrides,
      reason: d?.reason ?? "尚未视觉判断",
      review: {
        status: d?.verified ? "verified" : d ? "needs-recheck" : "pending",
        iteration: d?.iteration ?? 0,
        sheets: d?.reviewedSheets ?? [],
      },
      examples,
    };
  });
  const ids = values.ids ? new Set(values.ids.split(",").map(Number)) : null;
  const sheetRows = profiles
    .filter((p) => !ids || ids.has(p.id))
    .flatMap((p) => p.examples.map((e, index) => ({ p, e, index })));
  const revision = decisions.reduce((n, d) => n + d.iteration, 0);
  const sheetKey = createHash("sha256")
    .update(
      JSON.stringify({
        decisions,
        combined: values.combined,
        rows: sheetRows.map((r) => [r.p.id, r.e.pdfKey]),
      }),
    )
    .digest("hex")
    .slice(0, 10);
  const sheetFiles: string[] = [];
  for (let offset = 0; offset < sheetRows.length; offset += 6) {
    const rows = sheetRows.slice(offset, offset + 6);
    const elements = [`<rect width="100%" height="100%" fill="white"/>`];
    rows.forEach(({ p, e, index }, row) => {
      const y = row * 225;
      elements.push(
        `<text x="8" y="${y + 20}" font-family="Arial" font-size="17">${p.index}. ID ${p.id} | ${p.type} | example ${e.pdfKey} / glyph ${e.glyphId} | class ${p.category ?? "?"} | ${index + 1}/${p.examples.length}</text>`,
      );
      const images = [
        uri(readFileSync(join(out, "unicode", `${e.pdfKey}.png`)), "image/png"),
        uri(readFileSync(join(out, e.before))),
        uri(readFileSync(join(out, e.frame))),
        uri(readFileSync(join(out, e.after))),
      ];
      images.forEach((image, col) => {
        elements.push(
          `<image x="${col * 210 + 8}" y="${y + 27}" width="190" height="190" href="${image}"/>`,
        );
      });
      elements.push(
        `<text x="850" y="${y + 70}" font-family="Arial" font-size="14">x: ${e.rectangle.xbegin}..${e.rectangle.xend}</text><text x="850" y="${y + 92}" font-family="Arial" font-size="14">y: ${e.rectangle.ybegin}..${e.rectangle.yend}</text><path d="M0 ${y + 222}H980" stroke="#aaa"/>`,
      );
    });
    const name = `${values.combined ? "combined-" : ""}${ids ? "selected" : "all"}-r${revision}-${sheetKey}-${String(offset / 6 + 1).padStart(2, "0")}.png`;
    writeFileSync(
      join(out, "sheets", name),
      png(
        `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="${rows.length * 225}">${elements.join("")}</svg>`,
      ),
    );
    sheetFiles.push(`sheets/${name}`);
  }
  const decisionsSha256 = createHash("sha256")
    .update(JSON.stringify(decisions))
    .digest("hex");
  const visualAudit = existsSync(join(out, "final-audit.json"))
    ? read<{
        status: string;
        decisionsSha256: string;
        reviewedProfiles: number;
        reviewedExamples: number;
        sheets: { path: string; sha256: string }[];
      }>(join(out, "final-audit.json"))
    : null;
  const validation = existsSync(join(out, "validation.json"))
    ? read<{ status: string; decisionsSha256: string }>(
        join(out, "validation.json"),
      )
    : null;
  const topology = { decisionsSha256, ...审计外框拓扑(profiles) };
  write(join(out, "topology-audit.json"), topology);
  const complete =
    values.combined &&
    !ids &&
    decisions.length === items.length &&
    decisions.every((d) => d.verified) &&
    topology.status === "passed" &&
    validation?.status === "passed" &&
    validation.decisionsSha256 === decisionsSha256 &&
    visualAudit?.status === "passed" &&
    visualAudit.decisionsSha256 === decisionsSha256 &&
    visualAudit.reviewedProfiles === items.length &&
    visualAudit.reviewedExamples === sheetRows.length &&
    visualAudit.sheets.length === sheetFiles.length &&
    visualAudit.sheets.every(
      (s, i) =>
        s.path === sheetFiles[i] &&
        s.sha256 ===
          createHash("sha256")
            .update(readFileSync(join(out, s.path)))
            .digest("hex"),
    );
  const result = {
    schemaVersion: 1,
    status: complete ? "complete" : "in-progress",
    renderingMode: values.combined ? "combined" : "individual",
    decisionsSha256,
    verification: {
      visualAudit,
      validation,
      topology: { ...topology, checks: undefined },
    },
    unicodeVersion: "18.0.0",
    inputs,
    coordinateSystem: {
      min: 0,
      max: 100,
      origin: "top-left",
      rectangleMeaning:
        "内件原坐标 0..100 到矩形的仿射映射；坐标为复合体局部坐标",
      modifiedGlyphIds:
        "负数为离线临时 ID，导入前需由数据库分配新 ID，不可覆盖原 ID",
    },
    summary: {
      total: profiles.length,
      reviewed: decisions.length,
      verified: decisions.filter((d) => d.verified).length,
      rectangleOnly: decisions.filter((d) => d.category === 1).length,
      deformed: decisions.filter((d) => d.category === 2).length,
      examples: profiles.reduce((n, p) => n + p.examples.length, 0),
      sheetExamples: sheetRows.length,
    },
    profiles,
  };
  writeFileSync(join(out, "index.html"), gallery(profiles));
  write(join(out, "enclosure-profiles.json"), result);
  write(join(out, "latest-sheets.json"), sheetFiles);
  console.log(
    JSON.stringify({ ...result.summary, sheets: sheetFiles }, null, 2),
  );
}

function gallery(
  profiles: {
    index: number;
    id: number;
    name: string;
    category: number | null;
    reason: string;
    examples: (Example & {
      before: string;
      after: string;
      frame: string;
      rectangle: Rect;
    })[];
  }[],
) {
  const htmlEscape = (v: unknown) =>
    String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  const cards = profiles
    .map(
      (p) =>
        `<article data-kind="${p.category}" data-search="${htmlEscape(`${p.id} ${p.name} ${p.examples.map((e) => e.character).join("")}`)}"><h2>${p.index}. ${htmlEscape(p.name || "未命名外框")} · ID ${p.id} <small>第 ${p.category} 类</small></h2><p>${htmlEscape(p.reason)}</p><div class="alone"><figure><img src="renders/${p.id}-original.svg"><figcaption>原外框</figcaption></figure><figure><img src="renders/${p.id}-outer.svg"><figcaption>调整后外框</figcaption></figure></div>${p.examples
          .map(
            (e) =>
              `<section><h3>${htmlEscape(e.character)} · ${e.pdfKey} · 复合体 ${e.glyphId}</h3><div class="comparison">${[
                [`unicode/${e.pdfKey}.png`, "Unicode 18 原图"],
                [e.before, "原渲染"],
                [e.frame, "外框与内件矩形"],
                [e.after, "组合调整后"],
              ]
                .map(
                  ([src, label]) =>
                    `<figure><img loading="lazy" src="${src}"><figcaption>${label}</figcaption></figure>`,
                )
                .join(
                  "",
                )}</div><p class="coordinates">x: ${e.rectangle.xbegin}–${e.rectangle.xend}；y: ${e.rectangle.ybegin}–${e.rectangle.yend}</p></section>`,
          )
          .join("")}</article>`,
    )
    .join("");
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>171 个包围外框调整对照</title><style>body{font:16px/1.6 system-ui;background:#f2f4f7;color:#17212d;margin:0}header{position:sticky;top:0;background:#fff;padding:12px 24px;border-bottom:1px solid #ccd3db;z-index:1}h1{font-size:22px;margin:0}header p{margin:4px 0}input,select{padding:8px;font-size:16px}main{max-width:1100px;margin:auto;padding:20px}article{background:white;margin:0 0 24px;padding:20px;border-radius:10px}h2{margin:0;font-size:21px}small{color:#62778e}figure{margin:0;text-align:center}img{width:100%;max-width:220px;aspect-ratio:1;object-fit:contain}.comparison{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.alone{display:flex;gap:24px}.alone figure{width:145px}section{border-top:1px solid #ddd;margin-top:16px}h3{font-size:16px}.coordinates{color:#426755}button,a{color:#2365a2}@media(max-width:650px){.comparison{grid-template-columns:repeat(2,1fr)}}@media print{header{position:static}article{break-inside:avoid}}</style><header><h1>包围外框：171 项、268 个例子</h1><p>第 1 类：只调整矩形；第 2 类：外框变形并调整矩形。当前展示内外层同时应用新规则的结果。</p><input id="query" placeholder="搜索外框 ID、名称、例字"><select id="kind"><option value="">全部类别</option><option value="1">第 1 类 · 50 项</option><option value="2">第 2 类 · 121 项</option></select> <span id="count"></span> · <a href="enclosure-profiles.json">下载 JSON</a></header><main>${cards}</main><script>const q=document.querySelector('#query'),k=document.querySelector('#kind'),cards=[...document.querySelectorAll('article')];function filter(){let n=0;for(const c of cards){c.hidden=!(c.dataset.search.includes(q.value.trim())&&(!k.value||c.dataset.kind===k.value));if(!c.hidden)n++}document.querySelector('#count').textContent=n+' 项'}q.oninput=k.onchange=filter;filter()</script></html>`;
}

function verify() {
  const decisions = read<Decision[]>(join(out, "decisions.json"));
  const items = read<Item[]>(join(out, "items.json"));
  const result = read<{
    inputs: ReturnType<typeof inputHashes>;
    decisionsSha256: string;
    renderingMode: string;
    profiles: Parameters<typeof 审计外框拓扑>[0];
  }>(join(out, "enclosure-profiles.json"));
  const hash = createHash("sha256")
    .update(JSON.stringify(decisions))
    .digest("hex");
  if (result.decisionsSha256 !== hash || result.renderingMode !== "combined")
    throw new Error("先生成当前判断的组合渲染");
  if (JSON.stringify(result.inputs) !== JSON.stringify(inputHashes()))
    throw new Error("输入哈希改变");
  if (decisions.length !== items.length || !decisions.every((d) => d.verified))
    throw new Error("尚有未完成的判断");
  const topology = 审计外框拓扑(result.profiles);
  if (topology.status !== "passed")
    throw new Error(`部件拓扑不一致：${topology.failedProfiles.join(",")}`);
  const expected = new Set(items.map((i) => i.id));
  const definitions = new Map<number, 基本字形数据>();
  const checkRect = (r: Rect) => {
    if (
      !Object.values(r).every(
        (v) => Number.isFinite(v) && v >= 0 && v <= 100,
      ) ||
      r.xbegin >= r.xend ||
      r.ybegin >= r.yend
    )
      throw new Error(`无效矩形 ${JSON.stringify(r)}`);
  };
  for (const d of decisions) {
    if (!expected.delete(d.id)) throw new Error(`重复或未知外框 ${d.id}`);
    checkRect(d.rectangle);
    for (const r of Object.values(d.rectangles ?? {})) checkRect(r);
    const variants = [
      ...Object.values(d.contextVariants ?? {}),
      ...Object.values(d.innerVariants ?? {}),
    ];
    for (const v of variants) checkRect(v.rectangle);
    const outer = modified(glyphMap.get(d.id)!, d);
    const original = glyphMap.get(d.id)!;
    if (
      outer.type === "component" &&
      original.type === "component" &&
      JSON.stringify(outer.strokes.map((s) => s.feature)) !==
        JSON.stringify(original.strokes.map((s) => s.feature))
    )
      throw new Error(`外框 ${d.id} 改变笔画数量、种类或顺序`);
    for (const g of [
      outer,
      ...(d.auxiliaryGlyphs ?? []),
      ...variants.map((v) => v.modifiedGlyph),
    ]) {
      if (g.id >= 0) continue;
      if (definitions.has(g.id)) throw new Error(`重复临时 ID ${g.id}`);
      definitions.set(g.id, g);
    }
  }
  const combined = combinedGlyphs(decisions);
  const renderer = new 字形渲染器(combined);
  for (const g of definitions.values()) renderer.渲染(g);
  const inventory = read<Inventory>(
    join(root, "output/glyph-review/enclosure-inventory/inventory.json"),
  );
  const usageIds = new Set(
    inventory.items
      .filter((i) => items.some((p) => p.id === i.id))
      .flatMap((i) =>
        i.allUsages
          .filter((u) =>
            u.bindings.some((b) => b.unicode >= 0x4e00 && b.unicode <= 0x9fff),
          )
          .map((u) => u.glyphId),
      ),
  );
  const nonDefaultOuterReferences: number[] = [];
  for (const id of usageIds) {
    renderer.渲染(combined.get(id)!);
    const g = glyphMap.get(id)!;
    if (g.type === "compound") {
      const r = g.references[0]!;
      if (
        (r.xbegin ?? 0) !== 0 ||
        (r.ybegin ?? 0) !== 0 ||
        (r.xend ?? 100) !== 100 ||
        (r.yend ?? 100) !== 100
      )
        nonDefaultOuterReferences.push(id);
    }
  }
  const report = {
    status: "passed",
    decisionsSha256: hash,
    inputs: result.inputs,
    profiles: decisions.length,
    negativeGlyphDefinitions: definitions.size,
    basicCompoundGlyphsRendered: usageIds.size,
    nonDefaultOuterReferences,
    errors: [],
    topology: { ...topology, checks: undefined },
  };
  write(join(out, "validation.json"), report);
  console.log(JSON.stringify(report, null, 2));
}
if (import.meta.main) {
  if (positionals[0] === "prepare") prepare();
  else if (positionals[0] === "render") render();
  else if (positionals[0] === "verify") verify();
  else
    throw new Error(
      "用法：bun scripts/glyph-review/enclosure-profiles.ts prepare|render|verify [--combined] [--ids 608,4206]",
    );
}
