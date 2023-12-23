import { readFileSync, writeFileSync } from "fs";

const toJSON = (filename) => {
  const input = `libchai/assets/${filename}.txt`;
  const output = `public/cache/${filename}.json`;
  const content = readFileSync(input, "utf-8");
  const tsv = content
    .trim()
    .split("\n")
    .map((x) => {
      const [key, value] = x.split("\t");
      return [key, Number(value)];
    });
  const object = Object.fromEntries(tsv);
  writeFileSync(output, JSON.stringify(object));
};

for (const name of [
  "character_frequency",
  "word_frequency",
  "key_equivalence",
  "pair_equivalence",
]) {
  toJSON(name);
}
