import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { load } from "js-yaml";
import { 校验配置结构 } from "../dist/validation.js";
import { packageRoot, readDataFiles } from "./assets.js";

const { buffers } = readDataFiles();
const source = new URL("examples/", packageRoot);
const examples = readdirSync(source)
  .filter((file) => file.endsWith(".yaml"))
  .sort();
if (examples.length === 0) throw new Error("缺少示例方案 YAML");
const schemes = examples.map((file): [string, Buffer] => {
  const bytes = readFileSync(new URL(file, source));
  校验配置结构(load(bytes.toString("utf8")));
  return [file, bytes];
});
// 清理旧版资源，防止已取消发布的文件继续残留在 dist 中。
for (const file of [
  "glyph-id-legacy.js",
  "glyph-id-legacy.d.ts",
  "glyph-id-migration-map.json",
]) {
  rmSync(new URL(`dist/${file}`, packageRoot), { force: true });
}
for (const name of ["data", "examples"]) {
  const directory = new URL(`dist/${name}/`, packageRoot);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
}
for (const [file, bytes] of Object.entries(buffers)) {
  writeFileSync(new URL(`dist/data/${file}`, packageRoot), bytes);
}
for (const [file, bytes] of schemes) {
  writeFileSync(new URL(`dist/examples/${file}`, packageRoot), bytes);
}
chmodSync(new URL("dist/cli.js", packageRoot), 0o755);
