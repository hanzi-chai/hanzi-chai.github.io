import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import mupdf, {
  type DisplayList,
  type Page,
  type Pixmap,
  type Rect,
} from "mupdf";
import {
  CJK_CHART_URL,
  fetchIRGSources,
  UNICODE_VERSION,
  UNIHAN_URL,
} from "../unicode";
import { 读取来源 } from "./candidates";

const ROOT = resolve(import.meta.dir, "../..");
export const UNICODE_DIR = join(
  ROOT,
  "output/glyph-review/unicode",
  UNICODE_VERSION,
);
const PDF = join(UNICODE_DIR, "U4E00.pdf");
const IRG = join(UNICODE_DIR, "Unihan_IRGSources.txt");
const digest = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const writeJSON = (path: string, value: unknown) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const centerX = (box: Rect) => (box[0] + box[2]) / 2;

type Span = { text: string; font: string; size: number; bbox: Rect };
export type PDFGlyph = {
  unicode: number;
  source: string;
  irgSource: string;
  references: string[];
  reference: string;
  page: number;
  localization: "glyph-span" | "source-label-cell";
  glyphBox: Rect;
  labelBox: Rect;
  rowBox: Rect;
  cropAdjustments?: string[];
};
export type PDFIndex = {
  unicodeVersion: string;
  engine?: string;
  pdfSha256: string;
  irgSha256: string;
  pageCount: number;
  characterCount: number;
  expectedSourceCount?: number;
  records: Record<string, PDFGlyph>;
  issues: { key: string; page?: number; reason: string; matches?: number }[];
};

/** walk 保留浮点坐标；asJSON 会把坐标和字号截成整数，不适合定位。 */
function 提取文本片段(page: Page) {
  const text = page.toStructuredText("preserve-spans");
  const spans: Span[] = [];
  let current: Span | undefined;
  const flush = () => {
    if (current) spans.push(current);
    current = undefined;
  };
  try {
    text.walk({
      beginLine: flush,
      endLine: flush,
      onChar(char, _origin, font, size, quad) {
        const fontName = font.getName().replace(/^[A-Z]{6}\+/, "");
        font.destroy();
        if (!char.trim()) {
          flush();
          return;
        }
        const xs = [quad[0], quad[2], quad[4], quad[6]];
        const ys = [quad[1], quad[3], quad[5], quad[7]];
        const box: Rect = [
          Math.min(...xs),
          Math.min(...ys),
          Math.max(...xs),
          Math.max(...ys),
        ];
        if (
          current &&
          current.font === fontName &&
          Math.abs(current.size - size) < 0.01 &&
          Math.abs(current.bbox[1] - box[1]) < 0.1 &&
          box[0] - current.bbox[2] < 2 &&
          box[0] >= current.bbox[0]
        ) {
          current.text += char;
          current.bbox = [
            Math.min(current.bbox[0], box[0]),
            Math.min(current.bbox[1], box[1]),
            Math.max(current.bbox[2], box[2]),
            Math.max(current.bbox[3], box[3]),
          ];
        } else {
          flush();
          current = { text: char, font: fontName, size, bbox: box };
        }
      },
    });
    flush();
    return spans;
  } finally {
    text.destroy();
  }
}

/** 直接渲染页面指定方框，PDF 字体原样保留；不提取/重建字体轮廓。 */
function 裁图(page: Pick<Page, "run">, clip: Rect, scale: number) {
  const bounds: Rect = [
    Math.floor(clip[0] * scale),
    Math.floor(clip[1] * scale),
    Math.ceil(clip[2] * scale),
    Math.ceil(clip[3] * scale),
  ];
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, bounds, false);
  pixmap.clear(255);
  const device = new mupdf.DrawDevice(mupdf.Matrix.identity, pixmap);
  try {
    page.run(device, mupdf.Matrix.scale(scale, scale));
    device.close();
    return pixmap;
  } catch (error) {
    pixmap.destroy();
    throw error;
  } finally {
    device.destroy();
  }
}

function 检查墨迹(pixmap: Pixmap) {
  const pixels = pixmap.getPixels(),
    width = pixmap.getWidth(),
    height = pixmap.getHeight();
  const stride = pixmap.getStride(),
    components = pixmap.getNumberOfComponents();
  let inkPixels = 0,
    borderInkPixels = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = y * stride + x * components;
      if (
        Math.min(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!) <
        200
      ) {
        inkPixels++;
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1)
          borderInkPixels++;
      }
    }
  return { inkPixels, borderInkPixels };
}

export async function 下载Unicode(options: {
  cached?: boolean;
  sync?: boolean;
}) {
  mkdirSync(UNICODE_DIR, { recursive: true });
  if (!options.cached || !existsSync(IRG))
    writeFileSync(IRG, await fetchIRGSources());
  if (
    !readFileSync(IRG, "utf8").includes(
      `# Unicode Version ${UNICODE_VERSION}\n`,
    )
  )
    throw new Error("IRGSources 版本错误");
  if (!options.cached || !existsSync(PDF)) {
    const response = await fetch(CJK_CHART_URL);
    if (!response.ok) throw new Error(`码表下载失败：${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-")
      throw new Error("下载结果不是 PDF");
    writeFileSync(`${PDF}.part`, bytes);
    renameSync(`${PDF}.part`, PDF);
  }
  if (options.sync) {
    const { version } = JSON.parse(
      readFileSync(join(ROOT, "packages/hanzi-chai/package.json"), "utf8"),
    );
    for (const folder of [
      join(ROOT, "packages/hanzi-chai/src/data"),
      join(ROOT, "public/data", version),
    ]) {
      mkdirSync(folder, { recursive: true });
      copyFileSync(IRG, join(folder, "Unihan_IRGSources.txt"));
    }
  }
  writeJSON(join(UNICODE_DIR, "manifest.json"), {
    unicodeVersion: UNICODE_VERSION,
    files: {
      "U4E00.pdf": { url: CJK_CHART_URL, sha256: digest(PDF) },
      "Unihan_IRGSources.txt": { url: UNIHAN_URL, sha256: digest(IRG) },
    },
  });
  console.log(`已准备 Unicode ${UNICODE_VERSION}：${UNICODE_DIR}`);
}

export function 建立索引() {
  const sourceText = readFileSync(IRG, "utf8");
  if (!sourceText.includes(`# Unicode Version ${UNICODE_VERSION}\n`))
    throw new Error("IRGSources 版本错误");
  const expected = 读取来源(sourceText);
  const doc = mupdf.Document.openDocument(readFileSync(PDF), "application/pdf");
  const records: PDFIndex["records"] = {},
    issues: PDFIndex["issues"] = [];
  const seen = new Set<number>(),
    duplicates = new Set<string>();
  const cover = doc.loadPage(0),
    coverText = cover.toStructuredText("");
  try {
    if (!coverText.asText().includes("Version 18.0"))
      throw new Error("PDF 版本不是 Unicode 18.0");
  } finally {
    coverText.destroy();
    cover.destroy();
  }
  try {
    for (let pageNo = 1; pageNo < doc.countPages(); pageNo++) {
      const page = doc.loadPage(pageNo);
      try {
        const pageBounds = page.getBounds(),
          spans = 提取文本片段(page);
        const anchors = spans.filter(
          (s) =>
            s.size > 9 &&
            s.size < 11 &&
            s.bbox[1] > 90 &&
            /^[4-9][0-9A-F]{3}$/.test(s.text) &&
            s.bbox[0] < 335,
        );
        for (const anchor of anchors) {
          const cp = Number.parseInt(anchor.text, 16);
          seen.add(cp);
          const [x, y] = anchor.bbox;
          const nextY = Math.min(
            pageBounds[3] - 40,
            ...anchors
              .filter((a) => Math.abs(a.bbox[0] - x) < 3 && a.bbox[1] > y + 2)
              .map((a) => a.bbox[1]),
          );
          const row = spans.filter(
            (s) =>
              centerX(s.bbox) > x + 28 &&
              centerX(s.bbox) < x + 213 &&
              s.bbox[1] >= y - 2 &&
              s.bbox[1] < nextY - 2,
          );
          const glyphs = row.filter((s) => s.size >= 15),
            labels = row.filter((s) => s.font === "UnihanInfo");
          for (const [source, info] of expected.get(cp) ?? []) {
            const key = `${cp.toString(16).toUpperCase()}-${source}`,
              matches: PDFGlyph[] = [];
            for (const label of labels) {
              let text = label.text;
              const box: Rect = [...label.bbox];
              if (text.endsWith("-")) {
                const following = labels
                  .filter(
                    (s) =>
                      s.bbox[1] > box[1] &&
                      s.bbox[1] - box[1] < 9 &&
                      Math.abs(centerX(s.bbox) - centerX(box)) < 8,
                  )
                  .sort((a, b) => a.bbox[1] - b.bbox[1])[0];
                if (following) {
                  text += following.text;
                  box[3] = following.bbox[3];
                }
              }
              if (!info.references.includes(text)) continue;
              const center = centerX(box);
              const nearby = glyphs.filter(
                (g) =>
                  Math.abs(centerX(g.bbox) - center) < 6 &&
                  box[1] - g.bbox[1] > 7 &&
                  box[1] - g.bbox[1] < 30,
              );
              let localization: PDFGlyph["localization"] = "glyph-span",
                crop: Rect;
              if (nearby.length === 1) {
                const g = nearby[0]!;
                crop = [
                  g.bbox[0] - 1,
                  Math.min(g.bbox[1], box[1] - 24),
                  g.bbox[2] + 1,
                  box[1] - 0.5,
                ];
              } else if (nearby.length === 0) {
                crop = [
                  center - 12.5,
                  box[1] - 25,
                  center + 12.5,
                  box[1] - 0.5,
                ];
                localization = "source-label-cell";
              } else continue;
              const previousLabelBottom = Math.max(
                y - 2,
                ...labels
                  .filter(
                    (s) =>
                      s !== label &&
                      s.bbox[1] < box[1] - 3 &&
                      Math.abs(centerX(s.bbox) - center) < 6,
                  )
                  .map((s) => s.bbox[3] + 0.5),
              );
              const cropAdjustments =
                previousLabelBottom > crop[1]
                  ? ["previous-source-label-excluded"]
                  : [];
              crop[1] = Math.max(crop[1], previousLabelBottom);
              if (
                crop[0] < pageBounds[0] ||
                crop[1] < y - 2 ||
                crop[2] > pageBounds[2] ||
                crop[3] > nextY - 2 ||
                crop[0] >= crop[2] ||
                crop[1] >= crop[3]
              )
                continue;
              if (localization === "source-label-cell") {
                const probe = 裁图(page, crop, 2);
                try {
                  if (检查墨迹(probe).inkPixels < 4) continue;
                } finally {
                  probe.destroy();
                }
              }
              matches.push({
                unicode: cp,
                source,
                ...info,
                reference: text,
                page: pageNo + 1,
                localization,
                ...(cropAdjustments.length ? { cropAdjustments } : {}),
                glyphBox: crop,
                labelBox: box,
                rowBox: [x - 1, y - 2, x + 214, nextY - 2],
              });
            }
            if (records[key] || duplicates.has(key)) {
              delete records[key];
              duplicates.add(key);
              issues.push({
                key,
                page: pageNo + 1,
                reason: "duplicate-character-source",
              });
            } else if (matches.length === 1) records[key] = matches[0]!;
            else
              issues.push({
                key,
                page: pageNo + 1,
                reason: "source-label-or-glyph-not-unique",
                matches: matches.length,
              });
          }
        }
      } finally {
        page.destroy();
      }
      if (pageNo % 100 === 0)
        console.log(`已索引 ${pageNo}/${doc.countPages() - 1} 页`);
    }
    for (const [cp, entries] of expected)
      if (!seen.has(cp))
        for (const source of entries.keys())
          issues.push({
            key: `${cp.toString(16).toUpperCase()}-${source}`,
            reason: "codepoint-not-found",
          });
    const index: PDFIndex = {
      unicodeVersion: UNICODE_VERSION,
      engine: "mupdf.js 1.28.1",
      pdfSha256: digest(PDF),
      irgSha256: digest(IRG),
      pageCount: doc.countPages(),
      characterCount: seen.size,
      expectedSourceCount: [...expected.values()].reduce(
        (sum, m) => sum + m.size,
        0,
      ),
      records,
      issues,
    };
    const target = join(UNICODE_DIR, "index.json");
    if (existsSync(target))
      copyFileSync(
        target,
        join(UNICODE_DIR, `index-backup-${Date.now()}.json`),
      );
    writeJSON(target, index);
    console.log(
      `字形定位成功 ${Object.keys(records).length}，待处理 ${issues.length}；字符 ${seen.size}`,
    );
  } finally {
    doc.destroy();
  }
}

export function 生成裁图(options: {
  request: string;
  out: string;
  renders?: string;
}) {
  const index = JSON.parse(
    readFileSync(join(UNICODE_DIR, "index.json"), "utf8"),
  ) as PDFIndex;
  if (index.pdfSha256 !== digest(PDF) || index.irgSha256 !== digest(IRG))
    throw new Error("PDF 或 IRGSources 已变化，请重新生成索引");
  const keys = JSON.parse(readFileSync(options.request, "utf8")) as string[];
  const out = resolve(options.out);
  mkdirSync(out, { recursive: true });
  const doc = mupdf.Document.openDocument(readFileSync(PDF), "application/pdf");
  const records: Record<
    string,
    PDFGlyph & {
      image: string;
      rowImage: string;
      inkPixels: number;
      borderInkPixels: number;
    }
  > = {};
  const missing: string[] = [],
    rows = new Set<string>();
  let page: Page | undefined,
    display: DisplayList | undefined,
    croppedCount = 0,
    pageNo = -1;
  try {
    for (const key of keys) {
      const entry = index.records[key];
      if (!entry) {
        missing.push(key);
        continue;
      }
      if (pageNo !== entry.page) {
        display?.destroy();
        page?.destroy();
        page = doc.loadPage(entry.page - 1);
        display = page.toDisplayList(false);
        pageNo = entry.page;
      }
      const pixmap = 裁图(display!, entry.glyphBox, 8);
      let ink: ReturnType<typeof 检查墨迹>;
      try {
        ink = 检查墨迹(pixmap);
        if (ink.inkPixels === 0)
          throw new Error(`${key} 裁图为空白，请检查索引`);
        writeFileSync(join(out, `${key}.png`), pixmap.asPNG());
      } finally {
        pixmap.destroy();
      }
      const rowName = `${entry.unicode.toString(16).toUpperCase()}-row.png`;
      if (!rows.has(rowName)) {
        const row = 裁图(display!, entry.rowBox, 3);
        try {
          writeFileSync(join(out, rowName), row.asPNG());
        } finally {
          row.destroy();
        }
        rows.add(rowName);
      }
      records[key] = {
        ...entry,
        image: `${key}.png`,
        rowImage: rowName,
        ...ink,
      };
      croppedCount++;
      if (croppedCount % 1000 === 0)
        console.log(`已裁剪 ${croppedCount}/${keys.length} 个来源字形`);
    }
  } finally {
    display?.destroy();
    page?.destroy();
    doc.destroy();
  }
  const result = {
    records,
    missing,
    audit: {
      nonblank: Object.keys(records).length,
      borderInk: Object.entries(records)
        .filter(([, r]) => r.borderInkPixels > 0)
        .map(([k]) => k),
    },
  };
  writeJSON(join(out, "crops.json"), result);
  if (options.renders) 渲染候选PNG(options.renders);
  console.log(
    `已裁剪 ${Object.keys(records).length} 个来源字形；缺少定位 ${missing.length}`,
  );
  return result;
}

/** 当前 MuPDF.js 构建没有 SVG 输入 handler，候选 SVG 使用专用的 resvg 渲染。 */
export function 渲染候选PNG(folder: string) {
  const files = readdirSync(folder).filter((p) => p.endsWith(".svg"));
  for (const [index, filename] of files.entries()) {
    const path = join(folder, filename);
    const rendered = new Resvg(readFileSync(path), {
      font: { loadSystemFonts: false },
    }).render();
    writeFileSync(path.replace(/\.svg$/, ".png"), rendered.asPng());
    if ((index + 1) % 1000 === 0)
      console.log(`已生成 ${index + 1}/${files.length} 张候选及参考 PNG`);
  }
}
