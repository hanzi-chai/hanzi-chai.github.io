import { afterAll, describe, expect, it } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dump } from "js-yaml";
import {
  对比运行记录,
  读取方案项目,
  读取运行记录,
  评估方案项目,
  保存运行记录,
} from "../src/index.js";
import { fixtureBuffers, fixtureConfig } from "./fixtures/scheme.js";

const root = mkdtempSync(path.join(os.tmpdir(), "chai-cli-test-"));
const scheme = "schemes/scheme.yml";
const dataArgs = ["--data-dir", "data"];
const data = { directory: path.join(root, "data") };
const buffers = fixtureBuffers();
mkdirSync(path.join(root, "schemes"));
mkdirSync(data.directory);
writeFileSync(path.join(root, scheme), dump(fixtureConfig()));
for (const [file, contents] of Object.entries({
  "characters.json.deflate": buffers.characters,
  "glyphs.json.deflate": buffers.glyphs,
  "dictionary.txt": buffers.dictionary,
  "distribution.txt": buffers.distribution,
  "equivalence.txt": buffers.equivalence,
})) {
  writeFileSync(path.join(data.directory, file), contents);
}
afterAll(() => rmSync(root, { recursive: true, force: true }));
const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
function command(...args: string[]) {
  const result = Bun.spawnSync([process.execPath, cli, ...args, "--json"], {
    cwd: root,
  });
  return {
    code: result.exitCode,
    output: JSON.parse(result.stdout.toString()),
    stderr: result.stderr.toString(),
  };
}

describe("CLI 与方案快照", () => {
  it("子命令后传入方案 YML，可评估、构建及完整复现", () => {
    const evaluated = command("evaluate", scheme, ...dataArgs);
    expect(evaluated.code).toBe(0);
    expect(evaluated.output.result.entries).toBe(2);
    expect(evaluated.output.result.output).toBeUndefined();
    const baseline = path.join(root, "baseline");
    const built = command("build", scheme, ...dataArgs, "--out", baseline);
    expect(built.code).toBe(0);
    expect(built.output.result.entries).toBe(2);
    expect(readFileSync(path.join(baseline, "codes.tsv"), "utf8")).toContain(
      "二\taa",
    );
    const original = 读取运行记录(baseline);
    const reproduced = 评估方案项目(
      读取方案项目(path.join(baseline, "project")),
    );
    expect(reproduced).toEqual(original);
    expect(
      command("build", scheme, ...dataArgs, "--out", baseline).output
        .diagnostics[0].code,
    ).toBe("OUTPUT_EXISTS");
    const snapshot = command("evaluate", "baseline/project/chai.project.yaml");
    expect(snapshot.code).toBe(0);
    expect(snapshot.output.result.metadata).toEqual(
      evaluated.output.result.metadata,
    );
  });

  it("数据文件相对于工作目录解析，并覆盖数据目录中的同名角色", () => {
    writeFileSync(path.join(root, "one.tsv"), "一\tyi1\t100\n");
    const result = command(
      "validate",
      scheme,
      "--data-dir",
      "missing-data",
      "--characters",
      "data/characters.json.deflate",
      "--glyphs",
      "data/glyphs.json.deflate",
      "--dictionary",
      "one.tsv",
      "--distribution",
      "data/distribution.txt",
      "--equivalence",
      "data/equivalence.txt",
    );
    expect(result.code).toBe(0);
    expect(result.output.result).toMatchObject({ valid: true, entries: 1 });
    expect(
      command("validate", scheme, ...dataArgs, "--dictionary", "one.tsv").output
        .result,
    ).toEqual(result.output.result);
  });

  it("运行快照保留形近字根的映射顺序", () => {
    const config = fixtureConfig();
    config.data = {
      ...config.data,
      characters: [
        {
          unicode: "二".codePointAt(0)!,
          tygf: 1,
          glyphs: [{ id: 1, sources: ["G"] }],
        },
      ],
    };
    config.form.mapping["二"] = "b";
    config.form.mapping["一"] = "c";
    const file = "schemes/root-order.yml";
    const out = path.join(root, "root-order-run");
    writeFileSync(path.join(root, file), dump(config));
    expect(command("build", file, ...dataArgs, "--out", out).code).toBe(0);
    const original = 读取运行记录(out);
    expect(original.codes.map((x) => x.全码)).toEqual(["c", "c"]);
    const snapshot = 读取方案项目(path.join(out, "project"));
    expect(评估方案项目(snapshot)).toEqual(original);
  });

  it("比较键位改动及拆分变化，发现评估口径变化", () => {
    const loaded = 读取方案项目(path.join(root, scheme), data);
    const before = 评估方案项目(loaded);
    const beforeDir = path.join(root, "comparison-before");
    保存运行记录(beforeDir, before, loaded);
    const config = fixtureConfig();
    config.form.mapping["1"] = "b";
    const changed = path.join(root, "schemes/changed.yml");
    writeFileSync(changed, dump(config));
    const afterProject = 读取方案项目(changed, data);
    const after = 评估方案项目(afterProject);
    const diff = 对比运行记录(before, after);
    expect(diff.comparable).toBe(true);
    expect(diff.codes.map((x) => x.word)).toEqual(["一", "二"]);
    after.metadata.dataHashes.dictionary = "different";
    expect(对比运行记录(before, after)).toMatchObject({
      comparable: false,
      metrics: [],
      incompatibleFields: ["dataHashes"],
    });
    const out = path.join(root, "changed-run");
    保存运行记录(out, after, afterProject);
    expect(command("compare", beforeDir, out).output.result.comparable).toBe(
      false,
    );
  });

  it("命令错误与配置错误使用稳定 JSON 和退出码，stdout 不夹带日志", () => {
    expect(command("unknown").code).toBe(2);
    for (const args of [[scheme], [scheme, "evaluate"]]) {
      const result = command(...args, ...dataArgs);
      expect(result.code).toBe(2);
      expect(result.output.diagnostics[0].code).toBe("INVALID_ARGUMENT");
    }
    expect(command("evaluate", "--limit", "-1").code).toBe(2);
    expect(command("validate").code).toBe(2);
    expect(command("explain", scheme).code).toBe(2);
    expect(
      command("evaluate", scheme, "--custom-analysis", "invalid").code,
    ).toBe(2);
    const invalid = path.join(root, "invalid.yaml");
    writeFileSync(invalid, dump({ source: null, encoder: {} }));
    const result = command("validate", invalid);
    expect(result.code).toBe(1);
    expect(result.output.ok).toBe(false);
    expect(
      result.output.diagnostics.some(
        (x: { path: string }) => x.path === "/form/mapping",
      ),
    ).toBe(true);
    expect(
      command("inspect", "--components").output.result.selectors,
    ).toContain("取大优先");
    expect(
      command("explain", scheme, ...dataArgs, "--text", "一二").output.result
        .trace.supported,
    ).toBe(true);
    expect(
      command("analyze", scheme, ...dataArgs, "--text", "一𠀀").output.result
        .missing,
    ).toEqual(["𠀀"]);
  });

  it("正向校对保留多个参考编码，并在统计后筛选和分页", () => {
    writeFileSync(
      path.join(root, "reference.tsv"),
      "\ufeff一\tb\r\n一\ta\r\n二\tb\r\n一二\taa\r\n",
    );
    const args = [
      "proofread",
      scheme,
      ...dataArgs,
      "--reference",
      "reference.tsv",
    ];
    const result = command(...args);
    expect(result.code).toBe(0);
    expect(result.output.result).toMatchObject({
      direction: "forward",
      scope: "maximal",
      status: "incorrect",
      summary: { correct: 1, incorrect: 1, unknown: 0 },
      accuracy: 0.5,
      entries: {
        total: 1,
        items: [
          {
            词: "二",
            编码: "aa",
            参考编码列表: ["b"],
            状态: "incorrect",
            元素序列: [
              {
                元素序列: [
                  { element: "1", index: 0 },
                  { element: "1", index: 0 },
                ],
                条件列表: [],
              },
            ],
          },
        ],
      },
    });
    expect(
      command(...args, "--status", "all", "--limit", "1", "--offset", "1")
        .output.result,
    ).toMatchObject({
      summary: { correct: 1, incorrect: 1, unknown: 0 },
      entries: { total: 2, offset: 1, limit: 1, items: [{ 词: "二" }] },
    });
  });

  it("反向校对以参考码表为主体，并按字集和成字部件筛选", () => {
    const config = fixtureConfig();
    config.data = {
      ...config.data,
      characters: [
        { unicode: "三".codePointAt(0)!, glyphs: [{ id: 2, sources: ["G"] }] },
      ],
    };
    const file = "schemes/reverse-proofread.yml";
    writeFileSync(path.join(root, file), dump(config));
    writeFileSync(
      path.join(root, "reference.txt"),
      "b 一\na 一\nb 三\na 一二\na 𠀀\n",
    );
    const args = [
      "proofread",
      file,
      ...dataArgs,
      "--reference",
      "reference.txt",
      "--format",
      "code_space_char",
      "--direction",
      "reverse",
    ];
    const result = command(...args, "--status", "unknown");
    expect(result.code).toBe(0);
    expect(result.output.result).toMatchObject({
      summary: { correct: 1, incorrect: 1, unknown: 1 },
      accuracy: 0.5,
      entries: {
        total: 1,
        items: [
          {
            词: "三",
            编码: "b",
            参考编码列表: [],
            元素序列: [],
            状态: "unknown",
          },
        ],
      },
    });
    expect(
      command(...args, "--scope", "components").output.result,
    ).toMatchObject({
      summary: { correct: 1, incorrect: 1, unknown: 0 },
      entries: {
        total: 1,
        items: [{ 词: "一", 编码: "b", 参考编码列表: ["a"] }],
      },
    });
    expect(command(...args, "--scope", "gb2312").output.result).toMatchObject({
      summary: { correct: 0, incorrect: 0, unknown: 0 },
      accuracy: null,
    });
  });

  it("校对命令拒绝无效选项，并通过 JSON 报告参考码表读取错误", () => {
    expect(command("proofread", scheme).code).toBe(2);
    const args = [
      "proofread",
      scheme,
      ...dataArgs,
      "--reference",
      "missing.tsv",
    ];
    for (const option of ["--scope", "--format", "--status", "--direction"]) {
      expect(command(...args, option, "invalid").code).toBe(2);
    }
    const missing = command(...args);
    expect(missing.code).toBe(1);
    expect(missing.output.diagnostics[0].message).toContain("missing.tsv");
  });

  it("自定义元素文件参与输入哈希、组装和快照", () => {
    const config = fixtureConfig();
    config.form.mapping["测试-X"] = "b";
    config.encoder.sources.s1!.object = {
      type: "自定义",
      subtype: "测试",
      rootIndex: 1,
    };
    config.encoder.sources.s1!.next = null;
    const file = "schemes/custom.yml";
    writeFileSync(path.join(root, file), dump(config));
    writeFileSync(path.join(root, "custom=analysis.tsv"), "一\tX\n二\tX\n");
    const out = path.join(root, "custom-run");
    const built = command(
      "build",
      file,
      ...dataArgs,
      "--out",
      out,
      "--custom-analysis",
      "测试=custom=analysis.tsv",
      "--custom-analysis",
      "备用=custom=analysis.tsv",
    );
    expect(built.code).toBe(0);
    const run = 读取运行记录(out);
    expect(run.codes.map((x) => x.全码)).toEqual(["b", "b"]);
    expect(run.metadata.dataHashes["custom:测试"]).toBeDefined();
    expect(run.metadata.dataHashes["custom:备用"]).toBeDefined();
    expect(评估方案项目(读取方案项目(path.join(out, "project")))).toEqual(run);
  });
});
