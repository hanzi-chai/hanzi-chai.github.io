import { mergeClassifier } from "./classifier";
import {
  ComponentCache,
  ComponentResult,
  disassembleComponents,
  recursiveRenderComponent,
} from "./component";
import { CompoundCache, disassembleCompounds } from "./compound";
import { Config, CustomGlyph } from "./config";
import {
  Compound,
  Character,
  Repertoire,
  PrimitiveRepertoire,
  SVGGlyph,
  Component,
} from "./data";

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

export interface AnalysisResult {
  componentCache: ComponentCache;
  componentError: string[];
  customizations: ComponentCache;
  customized: ComponentCache;
  compoundCache: CompoundCache;
  compoundError: string[];
}

export const analysis = (repertoire: Repertoire, config: Config) => {
  const classifier = mergeClassifier(config.analysis?.classifier);
  const [componentCache, componentError] = disassembleComponents(
    repertoire,
    config,
    classifier,
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
    repertoire,
    config,
    customized,
  );
  const analysisResult: AnalysisResult = {
    componentCache,
    componentError,
    customizations,
    customized,
    compoundCache,
    compoundError,
  };
  return analysisResult;
};
