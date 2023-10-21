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
  if (
    !Array.from(name).every(
      (x) => x.charCodeAt(0) <= 0x9fa5 && x.charCodeAt(0) >= 0x4e00,
    )
  ) {
    console.log(name);
  }
  for (const [index, stroke] of glyph.entries()) {
    const { feature, curveList } = stroke;

    const { schema } = strokes[feature];
    if (schema !== curveList.map((x) => x.command).join("")) {
      console.log(name, index);
    }
  }
}
