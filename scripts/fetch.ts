/**
 * 从 api.chaifen.app 获取最新的数据 JSON 文件。
 * 从 assets.chaifen.app 获取最新的数据 TXT 文件。
 * 保存到 src/data 目录里。
 */

import { writeFileSync, mkdirSync, cpSync } from "node:fs";
import axios from "axios";
import pako from "pako";
import { 从模型构建, type 原始汉字模型 } from "~/api"
import { listToObject } from "~/lib";

const apiEndpoint = "https://api.chaifen.app/";
const assetsEndpoint = "https://assets.chaifen.app/";
const outputFolder = "packages/hanzi-chai/src/data/";
mkdirSync(outputFolder, { recursive: true });

const models: 原始汉字模型[] = await fetch(`${apiEndpoint}repertoire/all`).then((res) => res.json());
const repertoire = listToObject(models.map(从模型构建));

// Compress the repertoire data
const output = pako.deflate(JSON.stringify(repertoire));
writeFileSync(`${outputFolder}repertoire.json.deflate`, output);

for (const filename of [
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

cpSync(outputFolder, "public/cache/", { recursive: true });
