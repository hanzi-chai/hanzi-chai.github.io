import type {
  基本字形数据,
  复合体数据,
  字符数据,
} from "../../packages/hanzi-chai/src/data";

export const 人工范围 = [
  { start: 0x4e00, end: 0x6900 },
  { start: 0x7a70, end: 0x9fff },
];
export const 在人工范围 = (unicode: number) =>
  人工范围.some(({ start, end }) => unicode >= start && unicode <= end);
export const 来源映射: Record<string, string> = { KP: "N", UK: "B" };

export type 来源记录 = {
  irgSource: string;
  references: string[];
};
export function 读取来源(text: string) {
  const result = new Map<number, Map<string, 来源记录>>();
  for (const line of text.split("\n")) {
    const [code, field, value] = line.split("\t");
    const source = field?.match(/^kIRG_(\w+)Source$/)?.[1];
    if (!code?.startsWith("U+") || !source || !value) continue;
    const unicode = Number.parseInt(code.slice(2), 16);
    if (unicode < 0x4e00 || unicode > 0x9fff) continue;
    if (!result.has(unicode)) result.set(unicode, new Map());
    result.get(unicode)!.set(来源映射[source] ?? source, {
      irgSource: source,
      references: value.split(/\s+/),
    });
  }
  return result;
}

/** 对象键排序；保留布局、笔画块、ambiguous 等所有语义字段。 */
export function 字形签名(glyph: 基本字形数据): string {
  const { id, name, gf0014_id, gf3001_id, ...shape } = glyph;
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, normalize(v)]),
      );
    return value;
  };
  return JSON.stringify(normalize(shape));
}

type 票 = Map<number, Set<number>>;
export type 证据 = {
  position: number | null;
  from: number;
  to: number;
  scope: "context" | "global" | "whole" | "unchanged";
  support: number;
  total: number;
  examples: number[];
};
export type 候选 = {
  key: string;
  existingId: number | null;
  glyph: 基本字形数据;
  evidence: 证据[];
  rankingScore: number;
  kind: "whole" | "substitution" | "unchanged";
};

export class 候选生成器 {
  private glyphs: Map<number, 基本字形数据>;
  private signatures = new Map<string, number>();
  private votes = new Map<string, 票>();
  public trainingCharacters = 0;
  public skippedStructuralPairs = 0;

  constructor(
    characters: 字符数据[],
    glyphs: 基本字形数据[],
    excluded = new Set<number>(),
  ) {
    this.glyphs = new Map(glyphs.map((g) => [g.id, g]));
    for (const g of glyphs) this.signatures.set(字形签名(g), g.id);
    for (const character of characters) {
      if (!在人工范围(character.unicode) || excluded.has(character.unicode))
        continue;
      const base = this.获取参考(character);
      if (!base) continue;
      this.trainingCharacters++;
      for (const association of character.glyphs) {
        const target = this.glyphs.get(association.id);
        if (!target) continue;
        for (const source of association.sources) {
          if (source === base.source) continue;
          const prefix = `${base.source}|${source}`;
          this.投票(
            `${prefix}|whole|${base.glyph.id}`,
            target.id,
            character.unicode,
          );
          if (
            base.glyph.type !== "compound" ||
            target.type !== "compound" ||
            base.glyph.operator !== target.operator ||
            base.glyph.references.length !== target.references.length
          ) {
            this.skippedStructuralPairs++;
            continue;
          }
          base.glyph.references.forEach((ref, i) => {
            const to = target.references[i]!.id;
            this.投票(`${prefix}|global|${ref.id}`, to, character.unicode);
            this.投票(
              this.上下文键(prefix, base.glyph as 复合体数据, i),
              to,
              character.unicode,
            );
          });
        }
      }
    }
  }

  获取参考(character: 字符数据) {
    // 无 G 的字符显式采用其首个实际来源，不把它虚构成 G。
    const association =
      character.glyphs.find((g) => g.sources.includes("G")) ??
      character.glyphs.find((g) => g.sources.length > 0);
    if (!association) return null;
    const glyph = this.glyphs.get(association.id);
    if (!glyph) return null;
    return {
      glyph,
      source: association.sources.includes("G") ? "G" : association.sources[0]!,
    };
  }

  private 上下文键(prefix: string, glyph: 复合体数据, index: number) {
    return `${prefix}|context|${glyph.references[index]!.id}|${glyph.operator}|${glyph.references.length}|${index}`;
  }

  private 投票(key: string, target: number, unicode: number) {
    if (!this.votes.has(key)) this.votes.set(key, new Map());
    const vote = this.votes.get(key)!;
    if (!vote.has(target)) vote.set(target, new Set());
    vote.get(target)!.add(unicode);
  }

  private 选项(key: string) {
    const votes = this.votes.get(key) ?? new Map<number, Set<number>>();
    const total = [...votes.values()].reduce((sum, v) => sum + v.size, 0);
    return [...votes]
      .sort(([a, x], [b, y]) => y.size - x.size || a - b)
      .map(([id, examples]) => ({
        id,
        support: examples.size,
        total,
        examples: [...examples].sort((a, b) => a - b).slice(0, 3),
      }));
  }

  生成(character: 字符数据, source: string, limit = 6): 候选[] {
    const base = this.获取参考(character);
    if (!base) return [];
    const prefix = `${base.source}|${source}`;
    const results = new Map<string, Omit<候选, "key">>();
    const add = (
      glyph: 基本字形数据,
      evidence: 证据[],
      rankingScore: number,
      kind: 候选["kind"],
    ) => {
      const signature = 字形签名(glyph);
      const existingId = this.signatures.get(signature) ?? null;
      const previous = results.get(signature);
      if (!previous || rankingScore > previous.rankingScore)
        results.set(signature, {
          glyph,
          existingId,
          evidence,
          rankingScore,
          kind,
        });
    };
    const whole = this.选项(`${prefix}|whole|${base.glyph.id}`);
    for (const option of whole.slice(0, 3)) {
      add(
        this.glyphs.get(option.id)!,
        [
          {
            position: null,
            from: base.glyph.id,
            to: option.id,
            scope: "whole",
            ...option,
          },
        ],
        option.support / option.total,
        "whole",
      );
    }
    if (source !== base.source && base.glyph.type === "compound") {
      const original = base.glyph;
      let beam: { ids: number[]; evidence: 证据[]; score: number }[] = [
        { ids: [], evidence: [], score: 1 },
      ];
      for (const [index, ref] of original.references.entries()) {
        const context = this.选项(this.上下文键(prefix, original, index));
        const contextual = (context[0]?.total ?? 0) >= 3;
        const choices = (
          contextual ? context : this.选项(`${prefix}|global|${ref.id}`)
        ).slice(0, 3);
        if (!choices.some((x) => x.id === ref.id))
          choices.push({
            id: ref.id,
            support: 0,
            total: choices[0]?.total ?? 0,
            examples: [],
          });
        beam = beam
          .flatMap((partial) =>
            choices.map((choice) => ({
              ids: [...partial.ids, choice.id],
              evidence: [
                ...partial.evidence,
                {
                  position: index,
                  from: ref.id,
                  to: choice.id,
                  scope:
                    choice.total === 0
                      ? ("unchanged" as const)
                      : contextual
                        ? ("context" as const)
                        : ("global" as const),
                  support: choice.support,
                  total: choice.total,
                  examples: choice.examples,
                },
              ],
              // 仅用于候选排序，绝不解释为正确概率。
              score:
                partial.score *
                ((choice.support + 1) / (choice.total + choices.length)),
            })),
          )
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }
      for (const item of beam) {
        const { name, gf0014_id, gf3001_id, ...rest } = original;
        add(
          {
            ...rest,
            id: 0,
            references: original.references.map((ref, i) => ({
              ...ref,
              id: item.ids[i]!,
            })),
          },
          item.evidence,
          item.score,
          "substitution",
        );
      }
    }
    const identity = 字形签名(base.glyph);
    const sorted = [...results]
      .filter(([signature]) => signature !== identity)
      .sort(([, a], [, b]) => b.rankingScore - a.rankingScore)
      .slice(0, limit - 1);
    // 始终保留“无需替换”，其无样本支持状态是显式的。
    sorted.push([
      identity,
      results.get(identity) ?? {
        glyph: base.glyph,
        existingId: base.glyph.id,
        evidence: [],
        rankingScore: 0,
        kind: "unchanged",
      },
    ]);
    return sorted
      .sort(([, a], [, b]) => b.rankingScore - a.rankingScore)
      .map(([, value], index) => ({
        key: String.fromCharCode(65 + index),
        ...value,
      }));
  }
}
