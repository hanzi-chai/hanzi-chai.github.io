import rawrepertoire from "../public/cache/repertoire.json";
import type {
  AnalysisConfig,
  BasicComponent,
  Config,
  PrimitiveCharacter,
  Repertoire,
} from "~/lib";
import { determine, computeComponent } from "~/lib";

export const primitiveRepertoire = Object.fromEntries(
  (rawrepertoire as PrimitiveCharacter[]).map((x) => [
    String.fromCodePoint(x.unicode),
    x,
  ]),
);
export const repertoire = determine(primitiveRepertoire);
export const computedComponents = Object.fromEntries(
  Object.entries(repertoire)
    .filter(([_, v]) => v.glyph?.type === "basic_component")
    .map(([k, v]) => {
      const glyph = (v.glyph as BasicComponent).strokes;
      return [k, computeComponent(k, glyph)];
    }),
);

export const focusAnalysis = (config: Config, repertoire: Repertoire) => {
  const result: AnalysisConfig = {
    analysis: config.analysis ?? {},
    primaryRoots: new Map(
      Object.entries(config.form.mapping).filter(([x]) => repertoire[x]),
    ),
    secondaryRoots: new Map(
      Object.entries(config.form.grouping ?? []).filter(([x]) => repertoire[x]),
    ),
  };
  return result;
};
