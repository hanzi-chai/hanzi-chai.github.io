import { listToObject } from "~/lib/utils";
import rawform from "../public/cache/form.json";
import rawrepertoire from "../public/cache/repertoire.json";
import type { Character, Form, Glyph, Repertoire } from "~/lib/data";
import type { FormConfig, MergedData } from "~/lib/config";
import classifier from "~/lib/classifier";
import { renderComponentForm } from "~/lib/component";
import { defaultDegenerator } from "~/lib/degenerator";
import { defaultSelector } from "~/lib/selector";

export const form: Form = listToObject(rawform as Glyph[]);
export const repertoire: Repertoire = listToObject(
  rawrepertoire as Character[],
);
export const data: MergedData = { form, repertoire, classifier };
export const [rendered] = renderComponentForm(data);
export const computedGlyphs = Object.fromEntries(
  Object.entries(rendered).map(([k, v]) => [k, v.glyph]),
);
