import { readFileSync, writeFileSync } from "fs";
import { Character, Compound, PrimitiveCharacter } from "~/lib";

const repertoire = JSON.parse(
  readFileSync("public/cache/repertoire.json", "utf-8"),
) as PrimitiveCharacter[];

const descendants = new Map<string, string[]>();

for (const character of repertoire) {
  const name = String.fromCodePoint(character.unicode);
  if (!character.tygf) continue;
  const compound = character.glyphs.find((x) => x.type === "compound") as
    | Compound
    | undefined;
  if (!compound) continue;
  const children = compound.operandList;
  for (const [index, child] of children.entries()) {
    descendants.set(child, (descendants.get(child) ?? []).concat(name));
  }
}

const descendat_lists = [...descendants].sort(
  (a, b) => b[1].length - a[1].length,
);
writeFileSync(
  "public/cache/descendants.txt",
  descendat_lists.map(([char, des]) => `${char}\t${des.join("")}`).join("\n"),
);
