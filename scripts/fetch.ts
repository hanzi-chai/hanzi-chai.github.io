/**
 * 从 api.chaifen.app 获取最新的数据 JSON 文件。
 * 从 assets.chaifen.app 获取最新的数据 TXT 文件。
 * 保存到两个位置：
 * - packages/hanzi-chai/src/data/ (用于 Node.js 环境)
 * - public/data/${version}/ (用于网页，版本化避免缓存)
 */

import { writeFileSync, mkdirSync } from "fs";
import pako from "pako";
import { VERSION, getLocalDataPath } from "./version.js";
import {
  type 字形数据,
  type 字符数据,
  生成字形数据,
} from "hanzi-chai";

function saveCompressedJson(filename: string, data: unknown, debug = false) {
  const jsonString = JSON.stringify(data);
  const compressedData = pako.deflate(jsonString);
  if (debug) {
    writeFileSync(`${nodeOutputDir}/${filename}.json`, jsonString);
    writeFileSync(`${webOutputDir}/${filename}.json`, jsonString);
  }
  writeFileSync(`${nodeOutputDir}/${filename}.json.deflate`, compressedData);
  writeFileSync(`${webOutputDir}/${filename}.json.deflate`, compressedData);
}

const apiEndpoint = "https://api.chaifen.app/";
const assetsEndpoint = "https://assets.chaifen.app/";

const nodeOutputDir = "packages/hanzi-chai/src/data";
const webOutputDir = getLocalDataPath();
mkdirSync(nodeOutputDir, { recursive: true });
mkdirSync(webOutputDir, { recursive: true });

const characters: 字符数据[] = await fetch(`${apiEndpoint}characters/`).then((res) => res.json());
const glyphs: 字形数据[] = await fetch(`${apiEndpoint}glyphs/`).then((res) => res.json());
const resolvedGlyphs = 生成字形数据(glyphs);

saveCompressedJson("characters", characters, true);
saveCompressedJson("glyphs", resolvedGlyphs, true);

for (const filename of [
  "cjk",
  "dictionary",
  "distribution",
  "equivalence",
  "tygf",
  "gf0014",
]) {
  const url = `${assetsEndpoint}${filename}.txt`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    writeFileSync(`${nodeOutputDir}/${filename}.txt`, text);
    writeFileSync(`${webOutputDir}/${filename}.txt`, text);
    console.log(`已下载 ${filename}.txt`);
  } catch (error) {
    console.warn(`跳过 ${filename}.txt（服务器上不存在或者不可用）`);
  }
}

console.log(`\n所有资源已保存到:`);
console.log(`  Node.js: ${nodeOutputDir}`);
console.log(`  Web (v${VERSION}): ${webOutputDir}`);
