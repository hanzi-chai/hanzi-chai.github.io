import { preprocessForm, preprocessRepertoire } from "~/lib/utils";
import rawform from "../public/cache/form.json";
import rawrepertoire from "../public/cache/repertoire.json";
import findTopology from "~/lib/topology";
import mswb from "~/examples/mswb.yaml";
import { Config, FormConfig } from "~/lib/config";
import { Cache, renderComponentForm, renderComponentGlyphs } from "~/lib/form";
import { Form, Repertoire } from "~/lib/data";
import classifier from "~/lib/classifier";

export const form: Form = preprocessForm(rawform);
export const repertoire: Repertoire = preprocessRepertoire(rawrepertoire);
export const data: Config["data"] = { form, repertoire, classifier };
export const rendered = renderComponentGlyphs(data);
