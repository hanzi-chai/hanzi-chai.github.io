import { readFileSync, writeFileSync } from "fs";

const wen = JSON.parse(readFileSync("data/wen.json", "utf-8")) as Record<
  string,
  any
>;

const d1 = {} as Record<string, any>;
const d2 = {} as Record<string, any>;

for (const [key, value] of Object.entries(wen)) {
  d1[key] = value.shape[0].glyph;
  d2[key] = value.shape[0].reference;
}

writeFileSync("wen.json", JSON.stringify(d1));
writeFileSync("pingfang.json", JSON.stringify(d2));
