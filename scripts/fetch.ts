/**
 * 从 api.chaifen.app 获取最新的数据 JSON 文件。
 * 从 assets.chaifen.app 获取最新的数据 TXT 文件。
 * 保存到 /pubilc/cache 目录里。
 */

import { writeFileSync, mkdirSync } from "node:fs";
import axios from "axios";

const apiEndpoint = "https://api.chaifen.app/";
const assetsEndpoint = "https://assets.chaifen.app/";
const outputFolder = "public/cache/";
mkdirSync(outputFolder, { recursive: true });

const repertoire = JSON.stringify(
  await fetch(apiEndpoint + "repertoire/all").then((res) => res.json()),
);
writeFileSync(outputFolder + "repertoire.json", repertoire);

for (const filename of [
  "frequency",
  "dictionary",
  "key_distribution",
  "pair_equivalence",
  "tygf",
  "cjk",
]) {
  const url = `${assetsEndpoint}${filename}.txt`;
  const path = `${outputFolder}${filename}.txt`;
  const response = await axios.get(url);
  writeFileSync(path, response.data);
}
