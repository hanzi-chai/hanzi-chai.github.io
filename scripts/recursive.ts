import { readFileSync, writeFileSync } from "fs";
import type { Compound, PrimitiveCharacter } from "~/lib";

const repertoire = JSON.parse(
  readFileSync("public/cache/repertoire.json", "utf-8"),
) as PrimitiveCharacter[];

const descendants = new Map<string, string[]>();

for (const character of repertoire) {
  const name = String.fromCodePoint(character.unicode);
  if (!character.gb2312) continue;
  const compound = character.glyphs[0];
  if (compound?.type !== "compound") continue;
  const children = compound.operandList;
  for (const child of children.values()) {
    descendants.set(child, (descendants.get(child) ?? []).concat(name));
  }
}

const descendat_lists = [...descendants]
  .sort((a, b) => b[1].length - a[1].length)
  .filter(([_, des]) => des.length > 1);
writeFileSync(
  "public/cache/descendants.txt",
  descendat_lists.map(([char, des]) => `${char}\t${des.join("")}`).join("\n"),
);
