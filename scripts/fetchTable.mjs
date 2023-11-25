/**
 * 从 api.chaifen.app 获取码表文件。保存到 /pubilc/cache 目录里。
 */

import { writeFileSync, mkdirSync } from "node:fs";

const endpoint = "https://api.chaifen.app/";

mkdirSync("public/cache", { recursive: true });
for (const name in ["mswb", "zhengma"]) {
  const form = JSON.stringify(
    await fetch(endpoint + `ref/${name}`).then((res) => res.json()),
  );
  writeFileSync(`public/cache/${name}.json`, form);
}
