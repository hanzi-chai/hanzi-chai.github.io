import { describe, expect, it } from "bun:test";
import {
  准备方案,
  type 基本字形数据,
  本地编码评估,
  构建字库,
  type 结构描述字符,
  获取默认目标,
  评估方案项目,
  读取方案项目,
  运行方案,
} from "../src/index.js";
import {
  characters,
  dictionary,
  fixtureConfig,
  glyphs,
} from "./fixtures/scheme.js";

describe("真码取根", () => {
  for (const [operator, expected] of [
    ["⿺", "aba"],
    ["⿶", "baa"],
    ["⿲", "abaa"],
  ] as const) {
    for (const dynamic of [false, true]) {
      it(`嵌套 ${operator} 沿用结构次序（动态：${dynamic}）`, () => {
        const config = fixtureConfig();
        config.analysis = { compound_analyzer: "真码", dynamic };
        config.form.mapping = { 一: "a", 二: "b" };
        const parts = operator === "⿲" ? [1, 2, 1] : [1, 2];
        const nested: 基本字形数据 = {
          id: 3,
          type: "compound",
          operator: operator as 结构描述字符,
          references: parts.map((id) => ({ id })),
          strokes: parts.map((_, i) => ({ index: parts.length - i - 1 })),
        };
        const 字库 = 构建字库(
          config,
          [
            ...characters,
            {
              unicode: "品".codePointAt(0)!,
              tygf: 1,
              glyphs: [{ id: 4, sources: ["G"] }],
            },
          ],
          [
            ...glyphs,
            nested,
            {
              id: 4,
              type: "compound",
              operator: "⿰",
              references: [{ id: 3 }, { id: 1 }],
            },
          ],
        );
        const context = 准备方案(config, {
          字库,
          原始词典: [...dictionary, { 词: "品", 拼音: ["pin3"], 频率: 1 }],
        });
        const run = 运行方案(context);
        const [codes] = 本地编码评估(run.输入, 获取默认目标(config.encoder));
        expect(codes.find((x) => x.词 === "品")?.全码).toBe(expected);
      });
    }
  }

  it("参考表的共用分部、偏旁补码和交错笔顺", () => {
    const project = 读取方案项目(
      new URL("../examples/zhenma.yaml", import.meta.url).pathname,
    );
    const run = 评估方案项目(project);
    const codes = new Map(run.codes.map((x) => [x.词, x.全码]));
    for (const [char, code] of [
      ["键", "wcvl"],
      ["涟", "ipaf"],
      ["断", "xuek"],
      ["俞", "wkqn"],
      ["章", "ynfg"],
      ["胤", "qgxq"],
      ["率", "yoxf"],
      ["街", "egjj"],
      ["屮", "xlii"],
      ["丨", "liii"],
      ["口", "bi"],
      ["月", "q"],
      ["拔", "gsvy"],
      ["羲", "uhta"],
    ])
      expect(codes.get(char!)).toBe(code);
  }, 30_000);
});
