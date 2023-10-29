/**
 * 从 api.chaifen.app 获取最新的数据JSON文件。保存到 /pubilc/cache 目录里。
 */

import { writeFileSync, mkdirSync } from "node:fs";

const endpoint = "https://api.chaifen.app/";
const form = JSON.stringify(
  await fetch(endpoint + "form/all").then((res) => res.json()),
);
const repertoire = JSON.stringify(
  await fetch(endpoint + "repertoire").then((res) => res.json()),
);

mkdirSync("public/cache", { recursive: true });
writeFileSync("public/cache/form.json", form);
writeFileSync("public/cache/repertoire.json", repertoire);
