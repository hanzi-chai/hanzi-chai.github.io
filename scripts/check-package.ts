/** 在仓库外安装真正的 tarball，防止工作区链接、数据或前端依赖掩盖漏打包。 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageRoot } from "./assets.js";

const directory = mkdtempSync(path.join(tmpdir(), "hanzi-chai-package-"));
const npmEnv = {
  ...process.env,
  npm_config_cache: path.join(directory, "npm-cache"),
  npm_config_fetch_retries: "0",
  npm_config_fetch_timeout: "30000",
};
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
try {
  const [packed] = JSON.parse(
    execFileSync(
      npm,
      ["pack", "--ignore-scripts", "--json", "--pack-destination", directory],
      { cwd: fileURLToPath(packageRoot), encoding: "utf8", env: npmEnv },
    ),
  );
  writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  execFileSync(
    npm,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      path.join(directory, packed.filename),
    ],
    { cwd: directory, stdio: "inherit", env: npmEnv },
  );
  const installed = path.join(directory, "node_modules/hanzi-chai");
  assert.deepEqual(readdirSync(path.join(installed, "dist/data")).sort(), [
    "characters.json",
    "dictionary.txt",
    "distribution.txt",
    "equivalence.txt",
    "glyphs.json",
  ]);
  assert(
    readdirSync(path.join(installed, "dist/examples")).every((file) =>
      file.endsWith(".yaml"),
    ),
  );
  const cli =
    process.platform === "win32"
      ? path.join(installed, "dist/cli.js")
      : path.join(directory, "node_modules/.bin/chai");
  const run = (...args: string[]) =>
    JSON.parse(
      execFileSync("node", [cli, ...args, "--json"], {
        cwd: directory,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      }),
    );
  assert(
    run("examples").result.examples.some(
      ({ id }: { id: string }) => id === "snow4",
    ),
  );
  run("examples", "snow4", "--out", "snow4.yaml");
  assert(
    readFileSync(path.join(directory, "snow4.yaml"), "utf8").includes(
      "冰雪四拼",
    ),
  );
  assert.equal(run("validate", "snow4.yaml").result.valid, true);
  assert(run("evaluate", "snow4.yaml").result.entries > 0);
  const verificationCode = `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { createRequire } from 'node:module';
    import { 默认数据目录, 获取字库, 获取原始词典, 获取键位分布目标, 获取当量映射,
      列出示例方案, 读取示例配置, 获取示例方案路径, 读取方案项目, 最小方案,
      读取内置方案模板, 字符字形过滤器, GF0014映射, GF3001映射, 歧义字形, 分析当量数据, 运行方案, 格式化字形ID, 解析字形ID } from 'hanzi-chai';
    globalThis.fetch = () => { throw new Error('运行时不应联网'); };
    assert.equal(typeof 运行方案, 'function');
    assert(获取字库(最小方案).校验字符('一'));
    assert(获取原始词典().length > 0);
    assert(获取键位分布目标().size > 0);
    assert(获取当量映射().size > 0);
    assert(列出示例方案().length > 0);
    const example = createRequire(import.meta.url).resolve('hanzi-chai/examples/snow4.yaml');
    assert.equal(readFileSync(example, 'utf8'), readFileSync(获取示例方案路径('snow4'), 'utf8'));
    assert.equal(读取示例配置('snow4').info.name, '冰雪四拼');
    assert(读取方案项目(获取示例方案路径('snow4')).上下文);
    assert.throws(() => 获取示例方案路径('../snow4'));
    const templates = 读取内置方案模板();
    const starter = { name: '安装测试', data: '国标五分类', keyboard: '无', encoder: '形音码（米十五笔）' };
    const first = templates.createConfig(starter);
    const original = structuredClone(first);
    first.form.mapping['污染'] = 'z';
    first.analysis.selector.push('污染');
    assert.deepEqual(templates.createConfig(starter), original);
    const library = 获取字库(最小方案);
    const character = library.校验字符('一');
    assert(new 字符字形过滤器({ name: '一' }).过滤字符(character.character, character, library));
    assert.throws(() => createRequire(import.meta.url).resolve('hanzi-chai/legacy-ids'));
    assert.equal(格式化字形ID(0), '00000');
    assert.equal(解析字形ID('abcde'), 0xabcde);
    assert.equal(GF0014映射.get(0), 138);
    assert.equal(GF3001映射.get(0), 2);
    assert(歧义字形.has(0x00203));
    assert.deepEqual(分析当量数据([]).当量, []);
  `;
  execFileSync("node", ["--input-type=module", "--eval", verificationCode], {
    cwd: directory,
    stdio: "inherit",
  });
  console.log(`发布包验证通过：${packed.filename}（${packed.size} 字节）`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
