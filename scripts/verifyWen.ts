import { readFileSync } from "fs";
import { load } from "js-yaml";
import { Components } from "../lib/data";

const strokes = load(readFileSync("templates/strokes.yaml", "utf-8")) as Record<
  string,
  { class: number; schema: string }
>;
const components: Components = JSON.parse(
  readFileSync("data/components.json", "utf-8"),
);

for (const [name, glyph] of Object.entries(components)) {
  for (const [index, stroke] of glyph.entries()) {
    const { feature, curveList } = stroke;

    const { schema } = strokes[feature];
    if (schema !== curveList.map((x) => x.command).join("")) {
      console.log(name, index);
    }
  }
}
