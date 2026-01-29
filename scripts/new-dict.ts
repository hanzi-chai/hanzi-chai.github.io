import { readFileSync, writeFileSync } from "fs";
import pako from "pako";
import { 原始字库数据, 是私用区, 词典 } from "~/lib";

const frequency = new Map<string, number>();
const frequencyContent = readFileSync("public/cache/frequency.txt", "utf-8");
for (const line of frequencyContent.trim().split("\n")) {
  const [char, freqStr] = line.split("\t");
  frequency.set(char!, Number(freqStr));
}

const repertoire: 原始字库数据 = JSON.parse(
  pako.inflate(
    readFileSync("public/cache/repertoire.json.deflate"),
    { to: "string" }
  )
)

const newDict: 词典 = [];

for (const [char, data] of Object.entries(repertoire)) {
  const d = data as Record<string, any>;
  const readings = JSON.parse(d["readings"]);
  if (readings.length === 0) {
    readings.push({ pinyin: "", importance: 100 });
  }
  const f = frequency.get(char) || 0;
  if (!是私用区(char)) {
    for (const { pinyin, importance } of readings) {
      newDict.push({ 词: char, 拼音: [pinyin], 频率: Math.round(f * importance / 100.0) });
    }
  }
}

const dictionaryContent = readFileSync("public/cache/dictionary.txt", "utf-8");
for (const line of dictionaryContent.trim().split("\n")) {
  const [char, reading] = line.split("\t");
  const f = frequency.get(char!) || 0;
  newDict.push({ 词: char!, 拼音: [reading!], 频率: f });
}

writeFileSync(
  "public/cache/new_dictionary.txt",
  newDict.map((entry) => `${entry.词}\t${entry.拼音.join(",")}\t${entry.频率}`).join("\n")
)