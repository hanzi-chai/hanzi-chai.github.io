import { afterAll, describe, expect, it } from "bun:test";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  displacement,
  distance,
  type EquivalenceData,
  type Model,
  type Pair,
  partition,
  估计当量测量,
  分析当量数据,
  序列化当量统计,
} from "../src/index.js";

const directory = mkdtempSync(path.join(os.tmpdir(), "chai-equivalence-test-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const model: Model<Pair> = {
  group: new Set([
    { initial: 0, final: 0 },
    { initial: 0, final: 1 },
  ]),
  relation: (a, b) => a.initial === b.initial && a.final === b.final,
};
const sample = (
  baseline: number[],
  values: number[],
  user = "test",
): EquivalenceData => ({
  user,
  model: "test",
  data: [
    ...baseline.map((time) => ({ initial: 0, final: 0, time })),
    ...values.map((time) => ({ initial: 0, final: 1, time })),
  ],
});

describe("当量统计", () => {
  it("关系分组及手机键盘几何与原规则一致", () => {
    expect(
      partition({
        group: new Set([0, 1, 2, 3]),
        relation: (a, b) => a % 2 === b % 2,
      }).map((set) => [...set]),
    ).toEqual([
      [0, 2],
      [1, 3],
    ]);
    expect(distance({ initial: 0, final: 1 })).toBe(1);
    expect(distance({ initial: 0, final: 20 })).toBe(-1);
    expect(displacement({ initial: 0, final: 6 })).toEqual([1, 1]);
  });

  it("常量、单样本和异常值过滤不会产生无效估计", () => {
    expect(估计当量测量([100, 100, 100])).toEqual({
      value: 100,
      std: 0,
      length: 3,
    });
    expect(估计当量测量([100])).toEqual({ value: 100, std: 0, length: 1 });
    expect(估计当量测量([...Array(20).fill(100), 1000])).toEqual({
      value: 100,
      std: 0,
      length: 20,
    });
    expect(
      估计当量测量([Number.NaN, Number.POSITIVE_INFINITY, -1, 100]),
    ).toEqual({ value: 100, std: 0, length: 1 });
    expect(估计当量测量([]).length).toBe(0);
    expect(Number.isNaN(估计当量测量([]).value)).toBe(true);
  });

  it("基线归一化、误差修正及多人汇总保持原计算口径，不修改输入", () => {
    const records = [
      sample([100, 100], [200, 200], "a"),
      sample([100, 100], [300, 300], "b"),
    ];
    const original = structuredClone(records);
    const result = 分析当量数据(records, "test", model);
    expect(
      result.当量.map(({ distance, value, std }) => ({ distance, value, std })),
    ).toEqual([
      { distance: 0, value: 1, std: 0 },
      { distance: 1, value: 2.5, std: 0 },
    ]);
    expect(records).toEqual(original);
    expect(序列化当量统计(result.当量)).toEqual([
      ["组合", "分组", "当量", "不确定度"],
      ["0-0", "0A", "1", "0"],
      ["0-1", "1A", "2.5", "0"],
    ]);
    const corrected = 分析当量数据(
      [sample([90, 110], [180, 220])],
      "test",
      model,
    ).当量.find((group) => group.distance === 1)!;
    expect(corrected.value).toBeCloseTo(2.02, 10);
    expect(corrected.std).toBeCloseTo(Math.sqrt(0.02) * 2, 10);
  });

  it("空数据、缺少基线、零基线及缺测分组可安全处理", () => {
    expect(分析当量数据([], "test", model).当量).toEqual([]);
    expect(分析当量数据([sample([], [200])], "test", model).当量).toEqual([]);
    expect(分析当量数据([sample([0], [200])], "test", model).当量).toEqual([]);
    expect(
      分析当量数据([sample([100], [])], "test", model).当量.map(
        (group) => group.distance,
      ),
    ).toEqual([0]);
    expect(
      分析当量数据([sample([100], [200])], "different-model", model).当量,
    ).toEqual([]);
  });

  it("纯模块导入不联网、不写文件，文件输出由独立脚本完成", () => {
    const module = fileURLToPath(
      new URL("../src/equivalence.ts", import.meta.url),
    );
    const imported = Bun.spawnSync(
      [
        process.execPath,
        "--eval",
        `
      globalThis.fetch = () => { throw new Error('不应联网'); };
      const { 分析当量数据 } = await import(${JSON.stringify(module)});
      if (分析当量数据([]).当量.length) throw new Error('空数据结果不正确');
    `,
      ],
      { cwd: directory },
    );
    expect(imported.stdout.toString()).toBe("");
    expect(imported.stderr.toString()).toBe("");
    expect(imported.exitCode).toBe(0);
    expect(readdirSync(directory)).toEqual([]);
    const input = path.join(directory, "input.json");
    writeFileSync(
      input,
      JSON.stringify([
        { ...sample([100, 100], [200, 200]), model: "手机五行七列" },
      ]),
    );
    const output = path.join(directory, "output");
    const script = fileURLToPath(
      new URL("../scripts/analyze-equivalence.ts", import.meta.url),
    );
    const run = Bun.spawnSync([
      process.execPath,
      script,
      "--input",
      input,
      "--out",
      output,
    ]);
    expect(run.stderr.toString()).toBe("");
    expect(run.exitCode).toBe(0);
    expect(
      readFileSync(path.join(output, "equivalence.tsv"), "utf8"),
    ).toContain("0-0\t0A\t1\t0");
    const samples = JSON.parse(
      readFileSync(path.join(output, "samples.json"), "utf8"),
    );
    expect(
      samples.some((group: { set: unknown }) => Array.isArray(group.set)),
    ).toBe(true);
  });
});
