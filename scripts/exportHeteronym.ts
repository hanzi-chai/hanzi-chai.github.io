import { readFileSync, writeFileSync } from "fs";
import type { PrimitiveCharacter, PrimitiveRepertoire } from "~/lib/";

const repertoire: PrimitiveCharacter[] = JSON.parse(
  readFileSync("public/cache/repertoire.json", "utf-8"),
);

const data = repertoire
  .filter((char) => char.tygf > 0)
  .map((char) =>
    char.readings.map((reading) => [
      String.fromCodePoint(char.unicode),
      reading.pinyin,
      reading.importance,
    ]),
  )
  .flat();

writeFileSync(
  "public/cache/heteronyms.txt",
  data.map((line) => line.join("\t")).join("\n"),
  "utf-8",
);
