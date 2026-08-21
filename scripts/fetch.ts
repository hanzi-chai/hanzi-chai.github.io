/**
 * 从 api.chaifen.app 获取最新的数据 JSON 文件。
 * 从 assets.chaifen.app 获取最新的数据 TXT 文件。
 * 保存到两个位置：
 * - packages/hanzi-chai/src/data/ (用于 Node.js 环境)
 * - public/data/${version}/ (用于网页，版本化避免缓存)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import pako from "pako";
import { listCharacters, listGlyphs } from "../src/api";
import { getLocalDataPath, VERSION } from "./utils.js";

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

const assetsEndpoint = "https://assets.chaifen.app/";

const nodeOutputDir = "packages/hanzi-chai/src/data";
const webOutputDir = getLocalDataPath();
mkdirSync(nodeOutputDir, { recursive: true });
mkdirSync(webOutputDir, { recursive: true });

const characters = await listCharacters();
const glyphs = await listGlyphs();
if ("err" in characters || "err" in glyphs) {
  throw new Error("无法从 API 获取数据，请检查网络连接或 API 状态。");
}

saveCompressedJson("characters", characters, true);
saveCompressedJson("glyphs", glyphs, true);

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
  } catch {
    console.warn(`跳过 ${filename}.txt（服务器上不存在或者不可用）`);
  }
}

console.log(`\n所有资源已保存到:`);
console.log(`  Node.js: ${nodeOutputDir}`);
console.log(`  Web (v${VERSION}): ${webOutputDir}`);
