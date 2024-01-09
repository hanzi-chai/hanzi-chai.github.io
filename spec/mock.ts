import { listToObject } from "~/lib/utils";
import rawrepertoire from "../public/cache/repertoire.json";
import type { Character, RenderedComponent, Repertoire } from "~/lib/data";
import { determine } from "~/lib/repertoire";
import { computeComponent } from "~/lib/component";

export const repertoire: Repertoire = listToObject(rawrepertoire);
export const rendered = determine(repertoire);
export const computedGlyphs = Object.fromEntries(
  Object.entries(rendered)
    .filter(([k, v]) => v.glyph?.type === "component")
    .map(([k, v]) => {
      const glyph = (v.glyph as RenderedComponent).strokes;
      return [k, computeComponent(k, glyph).glyph];
    }),
);
