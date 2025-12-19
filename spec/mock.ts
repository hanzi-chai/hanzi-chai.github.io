import { readFileSync } from "node:fs";
import type {
  AnalysisConfig,
  BasicComponent,
  Config,
  PrimitiveCharacter,
  Repertoire,
} from "~/lib";
import { determine, computeComponent } from "~/lib";
import Pako from "pako";

const compressed = readFileSync("public/cache/repertoire.json.deflate");
const decompressed = Pako.inflate(compressed, { to: "string" });
const rawrepertoire = JSON.parse(decompressed);

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
    roots: new Map(
      Object.entries(config.form.mapping).filter(([x]) => repertoire[x]),
    ),
    optionalRoots: new Set<string>(),
  };
  return result;
};
