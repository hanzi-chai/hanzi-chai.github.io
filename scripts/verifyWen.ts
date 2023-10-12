import { readFileSync } from "fs";
import { load } from "js-yaml";
import { Wen } from "../lib/data";

const strokes: Record<string, { class: number; schema: string }> = load(
  readFileSync("templates/strokes.yaml", "utf-8"),
) as any;
const wen: Wen = JSON.parse(readFileSync("data/wen.json", "utf-8"));

for (const [name, glyph] of Object.entries(wen)) {
  for (const [index, stroke] of glyph.entries()) {
    const { feature, curveList } = stroke;

    const { schema } = strokes[feature];
    if (schema !== curveList.map((x) => x.command).join("")) {
      console.log(name, index);
    }
  }
}
