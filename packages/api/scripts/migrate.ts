import type {
  原始汉字模型,
  旧字形数据模型,
} from "./utils";
import { readFileSync, writeFileSync } from "node:fs";
import { post } from "./utils";
import { 字形数据, 字形来源数据, 字符数据, 引用笔画块数据, 旧引用笔画数据, 矢量笔画数据, 旧笔画块, 旧笔画数据, 部件数据 } from "hanzi-chai";

const 旧字符数据列表: 原始汉字模型[] = JSON.parse(
  readFileSync("data/repertoire.json", "utf-8"),
);

// 构建 unicode -> Glyph[] 的映射
const charMap = new Map<number, 旧字形数据模型[]>();
for (const char of 旧字符数据列表) {
  charMap.set(char.unicode, JSON.parse(char.glyphs));
}

// 存储已解析的 unicode -> glyph data ID 列表
// 这是 dedup 的关键：多个 Identity 指向同一个 unicode 时，会复用相同的 ID
const resolvedMap = new Map<number, 字形来源数据[]>();

// 存储所有非 Identity 的字形数据
const 字形数据列表: 字形数据[] = [];
let nextId = 1;

const processOrders = (
  order: 旧笔画块[] | undefined,
): 引用笔画块数据[] | undefined => {
  if (!order) return undefined;
  const cum = [0, 0, 0];
  return order.map((block) => {
    const result: 引用笔画块数据 = { index: block.index };
    result.from = cum[block.index];
    if (block.strokes > 0) {
      cum[block.index] += block.strokes;
      result.to = cum[block.index];
    }
    return result;
  });
};

const processStrokes = (
  strokes: 旧笔画数据[],
): (矢量笔画数据 | 引用笔画块数据)[] => {
  const newStrokes: (矢量笔画数据 | 引用笔画块数据)[] = [];
  let i = 0;
  while (i < strokes.length) {
    const stroke = strokes[i];
    if (stroke.feature === "reference") {
      const from = stroke.index;
      let to = stroke.index;
      i++;
      while (
        i < strokes.length &&
        strokes[i].feature === "reference" &&
        (strokes[i] as 旧引用笔画数据).index === to + 1
      ) {
        to = (strokes[i] as 旧引用笔画数据).index;
        i++;
      }
      newStrokes.push({ index: 0, from, to });
    } else {
      newStrokes.push(stroke);
      i++;
    }
  }
  return newStrokes;
};

/**
 * 递归解析一个字符的字形数据 ID 列表。
 * - 普通字形（非 Identity）：分配新 ID，加入字形数据列表
 * - Identity 字形：沿着 source 链递归解析，复用源字符的字形 ID
 */
function resolve(
  unicode: number,
  visited: Set<number> = new Set(),
): 字形来源数据[] {
  // 已经解析过，直接返回缓存结果
  const cached = resolvedMap.get(unicode);
  if (cached) {
    return cached;
  }

  // 检测循环引用
  if (visited.has(unicode)) {
    console.warn(`循环引用检测: unicode ${unicode}`);
    return [];
  }
  visited.add(unicode);

  const glyphs = charMap.get(unicode);
  if (!glyphs) {
    console.warn(`字符 ${unicode} 不在数据库中`);
    return [];
  }

  const id_sources: 字形来源数据[] = [];
  for (const glyph of glyphs) {
    if (glyph.type === "identity") {
      // Identity 字形：沿着 source 链解析，复用源字符的字形 ID
      // 每个 Identity 链使用独立的 visited 副本，避免不同链之间的干扰
      const parent = resolve(glyph.source, new Set(visited));
      id_sources.push(parent[0]); // Identity 字形只会有一个源字符，所以取第一个即可
    } else {
      // 非 Identity 字形：分配新 ID
      const id = nextId++;
      if (glyph.type === "basic_component") {
        const newGlyph: 部件数据 = {
          id,
          type: "component",
          strokes: glyph.strokes,
        };
        字形数据列表.push(newGlyph);
      } else if (glyph.type === "derived_component") {
        const parent = resolve(glyph.source, new Set(visited));
        const newGlyph: 部件数据 = {
          id,
          type: "component",
          strokes: processStrokes(glyph.strokes),
          references: [{ id: parent[0].id }],
        };
        字形数据列表.push(newGlyph);
      } else if (
        glyph.type === "spliced_component" ||
        glyph.type === "compound"
      ) {
        const parents = glyph.operandList.map(
          (op) => resolve(op, new Set(visited))[0],
        );
        const newGlyph = {
          id,
          type: glyph.type === "compound" ? "compound" : "component",
          operator: glyph.operator,
          references: parents.map((p) => ({ id: p.id })),
          strokes: processOrders(glyph.order),
        } as 字形数据;
        字形数据列表.push(newGlyph);
      }
      id_sources.push({ id, sources: glyph.tags ?? [] });
    }
  }

  resolvedMap.set(unicode, id_sources);
  return id_sources;
}

// 解析所有字符
const 字符数据列表: 字符数据[] = [];
for (const char of 旧字符数据列表) {
  const glyphIds = resolve(char.unicode);
  字符数据列表.push({
    unicode: char.unicode,
    tygf: char.tygf === 0 ? undefined : char.tygf,
    gb2312: char.gb2312 === 0 ? undefined : char.gb2312,
    glyphs: glyphIds,
    name: char.name === null ? undefined : char.name,
    ambiguous: char.ambiguous === 0 ? undefined : char.ambiguous,
  });
}

// 给一些字形数据补充 gf0014_id 和 gf3001_id
for (const char of 旧字符数据列表) {
  if (char.gf0014_id !== null) {
    const firstid = resolvedMap.get(char.unicode)?.[0]?.id;
    const glyph = 字形数据列表.find((g) => g.id === firstid);
    if (glyph) {
      glyph.gf0014_id = char.gf0014_id;
    }
  }
  if (char.gf3001_id !== null) {
    const firstid = resolvedMap.get(char.unicode)?.[0]?.id;
    const glyph = 字形数据列表.find((g) => g.id === firstid);
    if (glyph) {
      glyph.gf3001_id = char.gf3001_id;
    }
  }
}

writeFileSync(
  "data/repertoire_new.json",
  JSON.stringify(字符数据列表, null, 2),
);
writeFileSync("data/glyphs_new.json", JSON.stringify(字形数据列表, null, 2));

console.log(
  `迁移完成: ${字符数据列表.length} 个字符, ${字形数据列表.length} 条字形数据`,
);

// 一次性上传到 API
console.log("上传 characters...");
await post("/characters/batch", 字符数据列表);
console.log("上传 glyphs...");
await post("/glyphs/batch", 字形数据列表);
console.log("上传完成");
