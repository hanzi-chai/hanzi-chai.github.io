import rawrepertoire from "../public/cache/repertoire.json";
import type { BasicComponent } from "~/lib";
import { listToObject, determine, computeComponent } from "~/lib";

export const primitiveRepertoire = listToObject(rawrepertoire);
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
