import { listToObject } from "~/lib/utils";
import rawform from "../public/cache/form.json";
import rawrepertoire from "../public/cache/repertoire.json";
import { Config, FormConfig } from "~/lib/config";
import { Cache, renderComponentForm, renderComponentGlyphs } from "~/lib/form";
import { Character, Form, Repertoire } from "~/lib/data";
import classifier from "~/lib/classifier";

export const form: Form = listToObject(rawform);
export const repertoire: Repertoire = listToObject(
  rawrepertoire as Character[],
);
export const data: MergedData = { form, repertoire, classifier };
export const rendered = renderComponentGlyphs(data);
