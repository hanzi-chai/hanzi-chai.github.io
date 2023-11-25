import { listToObject } from "~/lib/utils";
import rawform from "../public/cache/form.json";
import rawrepertoire from "../public/cache/repertoire.json";
import type { Character, Form, Glyph, Repertoire } from "~/lib/data";
import type { FormConfig, MergedData } from "~/lib/config";
import { renderComponentGlyphs } from "~/lib/form";
import classifier from "~/lib/classifier";

export const form: Form = listToObject(rawform as Glyph[]);
export const repertoire: Repertoire = listToObject(
  rawrepertoire as Character[],
);
export const data: MergedData = { form, repertoire, classifier };
export const rendered = renderComponentGlyphs(data);

export const config: FormConfig = {
  alphabet: "",
  maxcodelen: 1,
  analysis: {
    degenerator: {
      feature: {
        捺: "点",
      },
      nocross: false,
    },
    selector: ["根少优先", "能连不交", "能散不连", "全符笔顺", "取大优先"],
    customize: {},
  },
  grouping: {},
  mapping: {},
};
