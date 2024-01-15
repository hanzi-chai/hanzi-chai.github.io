import { mergeClassifier } from "./classifier";
import {
  ComponentCache,
  ComponentResult,
  disassembleComponents,
  recursiveRenderComponent,
  recursiveRenderCompound,
} from "./component";
import { disassembleCompounds } from "./compound";
import { Config, CustomGlyph, KeyboardConfig } from "./config";
import {
  DerivedComponent,
  Compound,
  Character,
  Repertoire,
  PrimitiveRepertoire,
  SVGGlyph,
  Component,
} from "./data";
import type { Extra } from "./element";

export const findGlyph = (glyphs: (Component | Compound)[], tags: string[]) => {
  for (const tag of tags) {
    const withTag = glyphs.find((x) => (x.tags ?? []).includes(tag));
    if (withTag !== undefined) return withTag;
  }
  return glyphs[0];
};

export const determine = (
  repertoire: PrimitiveRepertoire,
  customization: CustomGlyph = {},
  tags: string[] = [],
) => {
  const determined: Repertoire = {};
  const glyphCache: Map<string, SVGGlyph> = new Map();
  for (const [name, character] of Object.entries(repertoire)) {
    const { ambiguous, glyphs, ...rest } = character;
    const rawglyph = customization[name] ?? findGlyph(glyphs, tags);
    let glyph: Character["glyph"];
    if (rawglyph?.type === "derived_component") {
      const svgglyph = recursiveRenderComponent(
        rawglyph,
        repertoire,
        glyphCache,
      );
      if (svgglyph instanceof Error) {
        continue;
      }
      glyph = {
        type: "basic_component",
        tags: rawglyph.tags,
        strokes: svgglyph,
      };
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
    config,
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

const getExtra = function (repertoire: Repertoire, config: Config): Extra {
  const { mapping, grouping } = config.form;
  const classifier = mergeClassifier(config.analysis?.classifier);
  const findSequence = (x: string) => {
    if (x.match(/[0-9]+/)) {
      return [...x].map(Number);
    }
    const glyph = repertoire[x]?.glyph;
    if (glyph === undefined) {
      return [];
    }
    if (glyph.type === "basic_component") {
      return glyph.strokes.map((s) => classifier[s.feature]);
    } else {
      const sequence = recursiveRenderCompound(glyph, repertoire);
      if (sequence instanceof Error) return [];
      return sequence.map((s) => classifier[s.feature]);
    }
  };
  const rootSequence = new Map<string, number[]>();
  const roots = Object.keys(mapping).concat(Object.keys(grouping));
  for (const root of roots) {
    rootSequence.set(root, findSequence(root));
  }
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
