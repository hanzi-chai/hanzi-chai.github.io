import { listToObject } from "~/lib/utils";
import rawrepertoire from "../public/cache/repertoire.json";
import type {
  PrimitveCharacter,
  BasicComponent,
  PrimitiveRepertoire,
} from "~/lib/data";
import { determine } from "~/lib/repertoire";
import { computeComponent } from "~/lib/component";

export const repertoire = determine(listToObject(rawrepertoire));
export const computedGlyphs = Object.fromEntries(
  Object.entries(repertoire)
    .filter(([k, v]) => v.glyph?.type === "basic_component")
    .map(([k, v]) => {
      const glyph = (v.glyph as BasicComponent).strokes;
      return [k, computeComponent(k, glyph)];
    }),
);
export const computedGlyphs2 = Object.fromEntries(
  Object.entries(computedGlyphs).map(([k, v]) => {
    return [k, v.glyph];
  }),
);
