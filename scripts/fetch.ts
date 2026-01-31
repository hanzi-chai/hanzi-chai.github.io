/**
 * 从 api.chaifen.app 获取最新的数据 JSON 文件。
 * 从 assets.chaifen.app 获取最新的数据 TXT 文件。
 * 保存到两个位置：
 * - packages/hanzi-chai/src/data/ (用于 Node.js 环境)
 * - public/data/${version}/ (用于网页，版本化避免缓存)
 */

import { writeFileSync, mkdirSync } from "fs";
import axios from "axios";
import pako from "pako";
import { 从模型构建, type 原始汉字模型 } from "~/api";
import { 原始字库数据 } from "~/lib";
import { VERSION, getLocalDataPath } from "./version.js";

const apiEndpoint = "https://api.chaifen.app/";
const assetsEndpoint = "https://assets.chaifen.app/";

const nodeOutputDir = "packages/hanzi-chai/src/data";
const webOutputDir = getLocalDataPath();
mkdirSync(nodeOutputDir, { recursive: true });
mkdirSync(webOutputDir, { recursive: true });

const models: 原始汉字模型[] = await fetch(`${apiEndpoint}repertoire/all`).then(
  (res) => res.json(),
);
const repertoire: 原始字库数据 = {};
for (const model of models) {
  const character = 从模型构建(model);
  const name = String.fromCodePoint(model.unicode);
  repertoire[name] = character;
}

// Compress the repertoire data
const output = pako.deflate(JSON.stringify(repertoire));
writeFileSync(`${nodeOutputDir}/repertoire.json.deflate`, output);
writeFileSync(`${webOutputDir}/repertoire.json.deflate`, output);

for (const filename of [
  "cjk",
  "dictionary",
  "distribution",
  "equivalence",
  "tygf",
]) {
  const url = `${assetsEndpoint}${filename}.txt`;
  try {
    const response = await axios.get(url);
    writeFileSync(`${nodeOutputDir}/${filename}.txt`, response.data);
    writeFileSync(`${webOutputDir}/${filename}.txt`, response.data);
    console.log(`已下载 ${filename}.txt`);
  } catch (error) {
    console.warn(`跳过 ${filename}.txt（服务器上不存在或者不可用）`);
  }
}

console.log(`\n所有资源已保存到:`);
console.log(`  Node.js: ${nodeOutputDir}`);
console.log(`  Web (v${VERSION}): ${webOutputDir}`);
