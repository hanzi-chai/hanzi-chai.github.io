/**
 * 从 api.chaifen.app 获取最新的数据 JSON 文件。
 * 从 assets.chaifen.app 获取最新的数据 TXT 文件。
 * 保存到两个位置：
 * - packages/hanzi-chai/src/data/ (用于 Node.js 环境)
 * - public/data/${version}/ (用于网页，版本化避免缓存)
 */

import { writeFileSync, mkdirSync } from "fs";
import axios from "axios";
import pako from "pako";
import { VERSION, getLocalDataPath } from "./version.js";
import {
  仿射变换,
  区间,
  type 矢量笔画数据,
  type 引用笔画块数据,
  type 部件数据,
  type 复合体数据,
  type 引用数据,
  type 结构描述字符,
  type 字形数据,
  type 字符数据,
  type 基本字形数据,
} from "hanzi-chai";

const apiEndpoint = "https://api.chaifen.app/";
const assetsEndpoint = "https://assets.chaifen.app/";

const nodeOutputDir = "packages/hanzi-chai/src/data";
const webOutputDir = getLocalDataPath();
mkdirSync(nodeOutputDir, { recursive: true });
mkdirSync(webOutputDir, { recursive: true });

// const models: 原始汉字模型[] = await fetch(`${apiEndpoint}repertoire/all`).then(
//   (res) => res.json(),
// );
// const repertoire: 原始汉字数据[] = models.map(从模型构建);
const characters: 字符数据[] = await fetch(`${apiEndpoint}characters/`).then((res) => res.json());
const glyphs: 字形数据[] = await fetch(`${apiEndpoint}glyphs/`).then((res) => res.json());

function saveCompressedJson(filename: string, data: unknown, debug = false) {
  const jsonString = JSON.stringify(data);
  const compressedData = pako.deflate(jsonString);
  if (debug) {
    writeFileSync(`${nodeOutputDir}/${filename}.json`, jsonString);
    writeFileSync(`${webOutputDir}/${filename}.json`, jsonString);
  }
  writeFileSync(`${nodeOutputDir}/${filename}.json.deflate`, compressedData);
  writeFileSync(`${webOutputDir}/${filename}.json.deflate`, compressedData);
}



function isVectorStroke(
  s: 矢量笔画数据 | 引用笔画块数据,
): s is 矢量笔画数据 {
  return "feature" in s;
}

function dereferenceGlyphs(glyphs: 字形数据[]): 基本字形数据[] {
  const glyphMap = new Map<number, 字形数据>();
  for (const g of glyphs) glyphMap.set(g.id, g);

  const strokeCache = new Map<number, 矢量笔画数据[]>();
  const resolving = new Set<number>();

  function resolveGlyph(id: number): 矢量笔画数据[] {
    const cached = strokeCache.get(id);
    if (cached) return cached;
    if (resolving.has(id))
      throw new Error(`循环引用: glyph ${id}`);

    const glyph = glyphMap.get(id);
    if (!glyph) throw new Error(`字形 ${id} 不存在`);

    resolving.add(id);
    try {
      let result: 矢量笔画数据[];
      if (glyph.type === "compound") {
        result = resolveCompound(glyph);
      } else if (glyph.operator) {
        result = resolveSplicedComponent(glyph);
      } else {
        result = resolveComponent(glyph);
      }
      strokeCache.set(id, result);
      return result;
    } finally {
      resolving.delete(id);
    }
  }

  function resolveComponent(glyph: 部件数据): 矢量笔画数据[] {
    const result: 矢量笔画数据[] = [];
    const refs = glyph.references ?? [];
    for (const stroke of glyph.strokes) {
      if (isVectorStroke(stroke)) {
        result.push(stroke);
      } else {
        const ref = refs[stroke.index];
        if (!ref) continue;
        const refStrokes = resolveGlyph(ref.id);
        const from = stroke.from ?? 0;
        const to = stroke.to ?? refStrokes.length;
        result.push(...refStrokes.slice(from, to));
      }
    }
    return result;
  }

  function transformRefStrokes(
    strokes: 矢量笔画数据[],
    ref: 引用数据,
    operator: 结构描述字符,
    index: number,
  ): 矢量笔画数据[] {
    const { xbegin, ybegin, xend, yend } = ref;
    if (
      xbegin !== undefined &&
      ybegin !== undefined &&
      xend !== undefined &&
      yend !== undefined
    ) {
      const transform = new 仿射变换(
        new 区间(xbegin, xend),
        new 区间(ybegin, yend),
      );
      return transform.变换笔画列表(strokes);
    }
    const transforms = 仿射变换.查找表[operator];
    if (transforms?.[index]) {
      return transforms[index].变换笔画列表(strokes);
    }
    return strokes;
  }

  function resolveCompoundLike(
    operator: 结构描述字符,
    references: 引用数据[],
    strokes: 引用笔画块数据[] | undefined,
  ): 矢量笔画数据[] {
    const partsStrokes = references.map((ref, i) => {
      const resolved = resolveGlyph(ref.id);
      return transformRefStrokes(resolved, ref, operator, i);
    });

    if (strokes && strokes.length > 0) {
      const result: 矢量笔画数据[] = [];
      const remaining = partsStrokes.map((s) => [...s]);
      for (const item of strokes) {
        const part = remaining[item.index];
        if (!part) continue;
        const from = item.from ?? 0;
        const to = item.to ?? part.length;
        result.push(...part.slice(from, to));
        remaining[item.index] = part.slice(to);
      }
      return result;
    }

    return partsStrokes.flat();
  }

  function resolveCompound(glyph: 复合体数据): 矢量笔画数据[] {
    return resolveCompoundLike(
      glyph.operator,
      glyph.references,
      glyph.strokes,
    );
  }

  function resolveSplicedComponent(glyph: 部件数据): 矢量笔画数据[] {
    const orderStrokes = glyph.strokes.filter(
      (s) => !isVectorStroke(s),
    ) as 引用笔画块数据[];
    return resolveCompoundLike(
      glyph.operator!,
      glyph.references ?? [],
      orderStrokes.length > 0 ? orderStrokes : undefined,
    );
  }

  const result: 基本字形数据[] = [];
  for (const glyph of glyphs) {
    try {
      if (glyph.type === "compound") {
        // 复合体数据保持原样，不解引用
        result.push(glyph);
      } else {
        // 部件数据：解引用所有引用笔画块数据
        const strokes = resolveGlyph(glyph.id);
        result.push({
          id: glyph.id,
          type: "component" as const,
          strokes,
          gf0014_id: glyph.gf0014_id,
          gf3001_id: glyph.gf3001_id,
        });
      }
    } catch (e) {
      console.warn(`跳过字形 ${glyph.id}: ${(e as Error).message}`);
    }
  }
  return result;
}

const resolvedGlyphs = dereferenceGlyphs(glyphs);
console.log(
  `已解引用 ${resolvedGlyphs.length} 个字形（原有 ${glyphs.length} 个）`,
);

saveCompressedJson("characters", characters, true);
saveCompressedJson("glyphs", resolvedGlyphs, true);

for (const filename of [
  "cjk",
  "dictionary",
  "distribution",
  "equivalence",
  "tygf",
  "gf0014",
]) {
  const url = `${assetsEndpoint}${filename}.txt`;
  try {
    const response = await axios.get(url);
    writeFileSync(`${nodeOutputDir}/${filename}.txt`, response.data);
    writeFileSync(`${webOutputDir}/${filename}.txt`, response.data);
    console.log(`已下载 ${filename}.txt`);
  } catch (error) {
    console.warn(`跳过 ${filename}.txt（服务器上不存在或者不可用）`);
  }
}

console.log(`\n所有资源已保存到:`);
console.log(`  Node.js: ${nodeOutputDir}`);
console.log(`  Web (v${VERSION}): ${webOutputDir}`);
