import { mergeClassifier } from "./classifier";
import {
  ComponentCache,
  ComponentResult,
  disassembleComponents,
  recursiveGetSequence,
  recursiveRenderComponent,
} from "./component";
import { disassembleCompounds } from "./compound";
import { Config, KeyboardConfig } from "./config";
import {
  Component,
  Compound,
  Character,
  Repertoire,
  PrimitiveRepertoire,
  SVGGlyph,
} from "./data";
import type { Extra } from "./element";

export const findGlyph = (glyphs: (Component | Compound)[], tags: string[]) => {
  for (const tag of tags) {
    const withTag = glyphs.find((x) => (x.tags ?? []).includes(tag));
    if (withTag !== undefined) return withTag;
  }
  return glyphs[0];
};

export const determine = (repertoire: PrimitiveRepertoire) => {
  const determined: Repertoire = {};
  const glyphCache: Map<string, SVGGlyph> = new Map();
  for (const [name, character] of Object.entries(repertoire)) {
    const { ambiguous, glyphs, ...rest } = character;
    // const glyph = customization[name]?.glyph ?? findGlyph(glyphs, tags);
    const rawglyph = glyphs[0];
    let glyph: Character["glyph"];
    if (rawglyph?.type === "component") {
      const svgglyph = recursiveRenderComponent(
        rawglyph,
        repertoire,
        glyphCache,
      );
      if (svgglyph instanceof Error) {
        continue;
      }
      glyph = { type: "component", tags: rawglyph.tags, strokes: svgglyph };
    } else {
      glyph = rawglyph;
    }
    const determined_character: Character = { ...rest, glyph };
    determined[name] = determined_character;
  }
  return determined;
};

export const getAnalysisCore = (data: Repertoire, config: Config) => {
  const [componentCache, componentError] = disassembleComponents(
    data,
    config.keyboards[0]!,
    mergeClassifier(config.analysis?.classifier),
  );
  const customizations: ComponentCache = new Map(
    Object.entries(config.analysis?.customize ?? {}).map(
      ([component, sequence]) => {
        const pseudoResult: ComponentResult = { sequence: sequence };
        return [component, pseudoResult] as const;
      },
    ),
  );
  const customized = new Map([...componentCache, ...customizations]);
  const [compoundCache, compoundError] = disassembleCompounds(
    data,
    config,
    customized,
  );
  return {
    componentCache,
    componentError,
    customizations,
    customized,
    compoundCache,
    compoundError,
  };
};

const getExtra = function (data: Repertoire, config: Config): Extra {
  const { mapping, grouping } = config.keyboards[0]!;
  const roots = Object.keys(mapping).concat(Object.keys(grouping));
  const findSequence = (x: string) => {
    if (data[x] === undefined) {
      // 单笔画
      return [Number(x)];
    }
    try {
      const sequence = recursiveGetSequence(data, x);
      if (sequence instanceof Error) {
        return [];
      }
      return sequence;
    } catch {
      return [];
    }
  };
  const rootSequence = Object.fromEntries(
    roots.map((x) => [x, findSequence(x)]),
  );
  return {
    rootSequence,
  };
};

export const getAnalysis = (
  list: string[],
  data: Repertoire,
  config: Config,
) => {
  const extra = getExtra(data, config);
  const { customized, compoundCache } = getAnalysisCore(data, config);
  const value = new Map(
    list.map((char) => {
      const result = customized.get(char) || compoundCache.get(char);
      // 这里只处理一种情况，未来可以返回多个拆分
      return result === undefined ? [char, []] : [char, [result]];
    }),
  );
  return [value, extra] as const;
};
