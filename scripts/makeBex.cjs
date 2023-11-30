/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 处理浏览器扩展的脚本，必须在 `npm run build:BEX` 之后执行此脚本。
 * 过程如下：
 * 1. 修改 src/bex/manifest.json 文件中的版本号。
 * 2. 把 src/bex 目录完全复制到 dist/bex 下。
 *
 * 本脚本执行结束后，请手动打开 Chromium 浏览器，生成 *.crx 文件。
 */

const { readFileSync, writeFileSync, copy } = require("fs-extra");
const { resolve } = require("node:path");

// const getAbsPath = (relativePath) => fileURLToPath(new URL(relativePath, import.meta.url))
const getAbsPath = (relativePath) => resolve(__dirname, relativePath);
const readJsonFile = (path) =>
  JSON.parse(readFileSync(path, { encoding: "utf-8" }));

const manifestPath = "../src/bex/manifest.json";
const packagePath = "../package.json";

const manifestContent = readJsonFile(getAbsPath(manifestPath));
const packageContent = readJsonFile(getAbsPath(packagePath));
manifestContent.version = packageContent.version;

writeFileSync(
  getAbsPath(manifestPath),
  JSON.stringify(manifestContent, undefined, 2),
  { encoding: "utf-8" },
);

copy(getAbsPath("../src/bex"), getAbsPath("../dist/bex"));
