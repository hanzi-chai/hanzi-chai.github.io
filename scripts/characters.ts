import { readFileSync, writeFileSync } from "fs";

const characters = JSON.parse(readFileSync("data/characters.json", "utf-8"));
const gb = readFileSync("data/gb.txt", "utf-8").trim().split("\n");
console.assert(gb.length === 6763);

const modified = Object.fromEntries(
  Object.entries(characters).map(([k, v]) => {
    return [k, { pinyin: v, tygf: true, gb2312: gb.includes(k) }];
  }),
);

for (const char of gb) {
  if (!modified[char]) {
    modified[char] = { pinyin: [], tygf: false, gb2312: true };
  }
}
const ordered = Object.keys(modified)
  .sort()
  .reduce(
    (obj, key) => {
      obj[key] = modified[key];
      return obj;
    },
    {} as Record<string, any>,
  );
writeFileSync("characters.json", JSON.stringify(ordered));
