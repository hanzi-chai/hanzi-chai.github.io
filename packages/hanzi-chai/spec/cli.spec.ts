import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dump } from "js-yaml";
import {
  对比运行记录,
  读取方案项目,
  读取运行记录,
  保存方案项目,
  评估方案项目,
  保存运行记录,
} from "../src/index.js";
import { fixtureBuffers, fixtureConfig } from "./fixtures/scheme.js";

const root = mkdtempSync(path.join(os.tmpdir(), "chai-cli-test-"));
const project = path.join(root, "project");
保存方案项目(project, fixtureConfig(), fixtureBuffers());
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
  it("从其他工作目录读取相对路径，构建、评估并完整复现", () => {
    const baseline = path.join(root, "baseline");
    const built = command("build", "--project", project, "--out", baseline);
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
      command("build", "--project", project, "--out", baseline).output
        .diagnostics[0].code,
    ).toBe("OUTPUT_EXISTS");
  });

  it("比较键位改动及拆分变化，发现评估口径变化", () => {
    const loaded = 读取方案项目(project);
    const before = 评估方案项目(loaded);
    const beforeDir = path.join(root, "comparison-before");
    保存运行记录(beforeDir, before, loaded);
    const config = fixtureConfig();
    config.form.mapping["1"] = "b";
    const changedProject = path.join(root, "changed");
    保存方案项目(changedProject, config, fixtureBuffers());
    const afterProject = 读取方案项目(changedProject);
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
    expect(command("evaluate", "--limit", "-1").code).toBe(2);
    expect(command("explain", "--project", project).code).toBe(2);
    const invalid = path.join(root, "invalid.yaml");
    writeFileSync(invalid, dump({ source: null, encoder: {} }));
    const result = command("validate", "--project", invalid);
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
      command("explain", "--project", project, "--text", "一二").output.result
        .trace.supported,
    ).toBe(true);
    expect(
      command("analyze", "--project", project, "--text", "一𠀀").output.result
        .missing,
    ).toEqual(["𠀀"]);
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
    const dir = path.join(root, "custom");
    保存方案项目(dir, config, {
      ...fixtureBuffers(),
      "custom:测试": new TextEncoder().encode("一\tX\n二\tX\n"),
    });
    const loaded = 读取方案项目(dir);
    const run = 评估方案项目(loaded);
    expect(run.codes.map((x) => x.全码)).toEqual(["b", "b"]);
    expect(loaded.hashes["custom:测试"]).toBeDefined();
    const out = path.join(root, "custom-run");
    保存运行记录(out, run, loaded);
    expect(评估方案项目(读取方案项目(path.join(out, "project")))).toEqual(run);
  });
});
