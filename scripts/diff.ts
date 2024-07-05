import { readFileSync, writeFileSync } from "fs";
import type { Compound, PrimitiveCharacter } from "~/lib";

const repertoire = JSON.parse(
  readFileSync("public/cache/repertoire.json", "utf-8"),
) as PrimitiveCharacter[];

const diff = [];

for (const { unicode, gb2312, tygf } of repertoire) {
  if (gb2312 && tygf === 0) {
    diff.push(String.fromCodePoint(unicode));
  }
}

writeFileSync("public/cache/diff.txt", diff.join(""));
