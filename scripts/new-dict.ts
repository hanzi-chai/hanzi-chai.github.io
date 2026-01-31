import { readFileSync, writeFileSync } from "fs";
import pako from "pako";
import { chars, 原始字库数据, 是私用区, 词典 } from "~/lib";
import { getLocalDataPath } from "./version.js";

const outputDir = getLocalDataPath();

const frequency = new Map<string, number>();
const frequencyContent = readFileSync(`${outputDir}/frequency.txt`, "utf-8");
for (const line of frequencyContent.trim().split("\n")) {
  const [char, freqStr] = line.split("\t");
  frequency.set(char!, Number(freqStr));
}

const repertoire: 原始字库数据 = JSON.parse(
  pako.inflate(
    readFileSync(`${outputDir}/repertoire.json.deflate`),
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

const dictionaryContent = readFileSync(`${outputDir}/dictionary.txt`, "utf-8");
for (const line of dictionaryContent.trim().split("\n")) {
  const [char, reading, freq] = line.split("\t");
  if (!char || chars(char) === 1) continue;
  newDict.push({ 词: char, 拼音: [reading!], 频率: Number(freq) });
}

writeFileSync(
  `${outputDir}/new_dictionary.txt`,
  newDict.map((entry) => `${entry.词}\t${entry.拼音.join(",")}\t${entry.频率}`).join("\n")
)