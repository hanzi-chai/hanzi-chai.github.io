import type { 原始汉字模型, 旧字形数据模型 } from "./utils";
import { readFileSync, writeFileSync } from "fs";
import { listToObject, post } from "./utils";

const sourceMap: Map<number, string[]> = new Map();
const variantMap: Map<number, number> = new Map();
const content = readFileSync("data/Unihan_IRGSources.txt", "utf-8");
const replacer = new Map([
  ["KP", "N"],
  ["UK", "B"],
]);
for (const line of content.split("\n")) {
  if (line.startsWith("#") || line.trim() === "") {
    continue;
  }
  const [unicode_str, field, value] = line.split("\t");
  const unicode = parseInt(unicode_str.slice(2), 16);
  if (field === "kCompatibilityVariant") {
    const sourceUnicode = parseInt(value.slice(2), 16);
    if (variantMap.has(unicode)) {
      console.warn(
        `Duplicate compatibility variant for U+${unicode.toString(16).toUpperCase()}: U+${sourceUnicode.toString(16).toUpperCase()}`,
      );
    } else {
      variantMap.set(unicode, sourceUnicode);
    }
  }
  if (!(field.startsWith("kIRG_") && field.endsWith("Source"))) {
    continue;
  }
  let tag = field.replace("kIRG_", "").replace("Source", "");
  if (replacer.has(tag)) {
    tag = replacer.get(tag)!;
  }
  if (!sourceMap.has(unicode)) {
    sourceMap.set(unicode, []);
  }
  sourceMap.get(unicode)!.push(tag);
}

const compatibility = new Set<number>();
for (let u = 0xf900; u <= 0xfa6d; u++) {
  compatibility.add(u);
}
for (let u = 0xfa70; u <= 0xfad9; u++) {
  compatibility.add(u);
}
for (let u = 0x2f800; u <= 0x2fa1d; u++) {
  compatibility.add(u);
}
const compatWithoutVariant = new Set<number>();
for (const unicode of compatibility) {
  if (!variantMap.has(unicode)) {
    console.warn(
      `Compatibility character U+${unicode.toString(16).toUpperCase()} has no source`,
    );
    compatWithoutVariant.add(unicode);
  }
}

const repertoire_list: 原始汉字模型[] = JSON.parse(
  readFileSync("data/repertoire.json", "utf-8"),
);
const repertoire = listToObject(repertoire_list);
for (const unicode of compatibility) {
  const char = String.fromCodePoint(unicode);
  if (compatWithoutVariant.has(unicode)) {
    console.assert(
      repertoire[char] !== undefined,
      `Compatibility character U+${unicode.toString(16).toUpperCase()} not found in repertoire`,
    );
  } else {
    const sourceUnicode = variantMap.get(unicode)!;
    const model: 原始汉字模型 = {
      unicode,
      tygf: 0,
      gb2312: 0,
      gf0014_id: null,
      gf3001_id: null,
      name: null,
      glyphs: JSON.stringify([{ type: "identity", source: sourceUnicode }]),
      ambiguous: 0,
    };
    repertoire[char] = model;
  }
}

const processed = new Set();
for (const [name, character] of Object.entries(repertoire)) {
  const tags = sourceMap.get(character.unicode);
  if (tags === undefined) {
    continue;
  }
  const glyphs = JSON.parse(character.glyphs) as 旧字形数据模型[];
  glyphs.forEach((glyph) => {
    glyph.tags = (glyph.tags ?? []).concat(tags);
  });
  character.glyphs = JSON.stringify(glyphs);
  processed.add(character.unicode);
}

console.log("All tags:", Array.from(new Set([...sourceMap.values()].flat())));
console.log("Total characters", sourceMap.size);
console.log("Total count:", [...sourceMap.values()].flat().length);
console.log("Processed characters:", processed.size);
console.log(
  "Unprocessed characters:",
  [...sourceMap.keys()]
    .filter((k) => !processed.has(k))
    .map((k) => `U+${k.toString(16).toUpperCase()}`),
);

writeFileSync(
  "data/repertoire_with_tags.json",
  JSON.stringify(Object.values(repertoire)),
);
post("/repertoire/batch", Object.values(repertoire));
