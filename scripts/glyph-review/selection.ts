import { createHash } from "node:crypto";
import type {
  基本字形数据,
  字符数据,
} from "../../packages/hanzi-chai/src/data";
import { 在人工范围, 获取参考字形 } from "./candidates";

export function 选择字符(
  characters: 字符数据[],
  glyphs: Map<number, 基本字形数据>,
  sourceCodes: Set<number>,
  options: {
    from: number;
    to: number;
    holdout: boolean;
    limit: number | null;
    seed?: string;
  },
) {
  const eligible = characters.filter((character) => {
    if (
      !sourceCodes.has(character.unicode) ||
      character.unicode < options.from ||
      character.unicode > options.to
    )
      return false;
    if (!options.holdout) return true;
    return (
      在人工范围(character.unicode) &&
      获取参考字形(character, glyphs)?.glyph.type === "compound" &&
      new Set(character.glyphs.map((g) => g.id)).size >= 2
    );
  });
  const rank = (cp: number) =>
    createHash("sha256").update(`${options.seed}:${cp}`).digest("hex");
  eligible.sort(
    options.seed
      ? (a, b) => rank(a.unicode).localeCompare(rank(b.unicode))
      : (a, b) => a.unicode - b.unicode,
  );
  const chosen =
    options.limit === null ? eligible : eligible.slice(0, options.limit);
  const code = (cp: number) => `U+${cp.toString(16).toUpperCase()}`;
  return {
    chosen,
    selection: {
      from: code(options.from),
      to: code(options.to),
      inclusive: true,
      referenceGlyphType: options.holdout ? "compound" : null,
      minimumDistinctGlyphIds: options.holdout ? 2 : null,
      historicalRangesOnly: options.holdout,
      eligibleCount: eligible.length,
      selectedCount: chosen.length,
      limit: options.limit,
      order: options.seed
        ? "sha256(seed + ':' + decimal-codepoint)"
        : "unicode-ascending",
      seed: options.seed ?? null,
      selectedCodepoints: chosen.map((c) => code(c.unicode)),
      compoundDefinition: options.holdout
        ? "G-source reference glyph (or first existing source if G is absent) is compound; other source variants may be components"
        : null,
    },
  };
}
