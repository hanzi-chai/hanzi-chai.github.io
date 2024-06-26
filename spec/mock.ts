import rawrepertoire from "../public/cache/repertoire.json";
import type {
  AnalysisConfig,
  BasicComponent,
  Config,
  PrimitiveCharacter,
  Repertoire,
} from "~/lib";
import { listToObject, determine, computeComponent } from "~/lib";

export const primitiveRepertoire = Object.fromEntries(
  (rawrepertoire as PrimitiveCharacter[]).map((x) => [
    String.fromCodePoint(x.unicode),
    x,
  ]),
);
export const repertoire = determine(primitiveRepertoire);
export const computedComponents = Object.fromEntries(
  Object.entries(repertoire)
    .filter(([k, v]) => v.glyph?.type === "basic_component")
    .map(([k, v]) => {
      const glyph = (v.glyph as BasicComponent).strokes;
      return [k, computeComponent(k, glyph)];
    }),
);
export const computedGlyphs2 = Object.fromEntries(
  Object.entries(computedComponents).map(([k, v]) => {
    return [k, v.glyph];
  }),
);

export const focusAnalysis = (config: Config, repertoire: Repertoire) => {
  const result: AnalysisConfig = {
    analysis: config.analysis ?? {},
    primaryRoots: new Set(
      Object.keys(config.form.mapping).filter((x) => repertoire[x]),
    ),
    secondaryRoots: new Set(
      Object.keys(config.form.grouping ?? []).filter((x) => repertoire[x]),
    ),
  };
  return result;
};
