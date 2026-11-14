import { afterAll, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureBuffers } from "./fixtures/scheme.js";

const directory = mkdtempSync(path.join(os.tmpdir(), "chai-assets-test-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const dataDirectory = path.join(directory, "data");
mkdirSync(dataDirectory);
const buffers = fixtureBuffers();
for (const [filename, bytes] of Object.entries({
  "characters.json": buffers.characters,
  "glyphs.json": buffers.glyphs,
  "dictionary.txt": buffers.dictionary,
  "distribution.txt": buffers.distribution,
  "equivalence.txt": buffers.equivalence,
})) {
  writeFileSync(path.join(dataDirectory, filename), bytes);
}

it("发布数据校验缺失和格式，允许原地更新，失败下载不覆盖已有数据", () => {
  const assets = new URL("../scripts/assets.ts", import.meta.url).href;
  const downloader = new URL("../scripts/fetch-data.ts", import.meta.url).href;
  const code = `
    import assert from 'node:assert/strict';
    import { readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
    import { pathToFileURL } from 'node:url';
    import { readDataFiles, validateData, dataSources } from ${JSON.stringify(assets)};
    import { fetchDataFiles } from ${JSON.stringify(downloader)};
    const directory = pathToFileURL(process.argv[1] + '/');
    const { buffers } = readDataFiles(directory);
    const dictionary = new URL('dictionary.txt', directory);
    writeFileSync(dictionary, '一\\tyi1\\t99\\n');
    assert.equal(readDataFiles(directory).buffers['dictionary.txt'].toString(), '一\\tyi1\\t99\\n');
    rmSync(dictionary);
    assert.throws(() => readDataFiles(directory), /缺少必需数据/);
    writeFileSync(dictionary, buffers['dictionary.txt']);
    for (const [file, text] of [
      ['dictionary.txt', '<html>unavailable</html>'],
      ['dictionary.txt', '一\\tyi1\\tnot-a-number'],
      ['distribution.txt', 'a\\t1'],
      ['equivalence.txt', ''],
      ['characters.json', '[]'],
      ['characters.json', '{"err":"failed"}'],
      ['glyphs.json', 'broken'],
    ]) assert.throws(() => validateData(file, Buffer.from(text)));
    let failure;
    globalThis.fetch = async (url) => {
      const file = Object.keys(dataSources).find((file) => dataSources[file] === url);
      if (file === failure) return new Response('unavailable', { status: 503 });
      return new Response(buffers[file]);
    };
    failure = 'equivalence.txt';
    await assert.rejects(fetchDataFiles(directory), /HTTP 503/);
    for (const [file, bytes] of Object.entries(buffers)) {
      assert.deepEqual(readFileSync(new URL(file, directory)), bytes);
    }
    failure = undefined;
    const downloaded = await fetchDataFiles(directory);
    assert.deepEqual(readDataFiles(directory).buffers, downloaded);
    assert.deepEqual(readdirSync(directory).sort(), Object.keys(dataSources).sort());
  `;
  const result = Bun.spawnSync(["bun", "--eval", code, dataDirectory], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
  });
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
