/** 下载核心发布数据，并准备前端及开发核验所用资源。 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getLocalDataPath } from "./data-path.js";
import { fetchDataFiles } from "./fetch-data.js";
import { fetchIRGSources } from "./unicode.js";

const nodeOutputDir = getLocalDataPath();
mkdirSync(nodeOutputDir, { recursive: true });

// 与 npm 发布共用严格下载流程，不依赖前端 API 模块。
await fetchDataFiles();
// 核心运行之外的数据：gf0014 供网页使用，cjk、tygf 供开发核验；均不随 npm 包发布。
for (const filename of ["cjk", "tygf", "gf0014"]) {
  try {
    const response = await fetch(`https://assets.chaifen.app/${filename}.txt`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    writeFileSync(`${nodeOutputDir}/${filename}.txt`, text);
    console.log(`已下载 ${filename}.txt`);
  } catch {
    console.warn(`跳过 ${filename}.txt（服务器上不存在或者不可用）`);
  }
}

const irgSources = await fetchIRGSources();
writeFileSync(`${nodeOutputDir}/Unihan_IRGSources.txt`, irgSources);
console.log(`\n所有资源已保存到: ${nodeOutputDir}`);
