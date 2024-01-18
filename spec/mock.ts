import { listToObject } from "~/lib";
import rawrepertoire from "../public/cache/repertoire.json";
import type {
  PrimitiveCharacter,
  BasicComponent,
  PrimitiveRepertoire,
} from "~/lib";
import { determine } from "~/lib";
import { computeComponent } from "~/lib";

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
