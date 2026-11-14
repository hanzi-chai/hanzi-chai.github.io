import { describe, expect, it } from "bun:test";
import {
  type StarterType,
  创建方案模板,
  读取内置方案模板,
  读取示例配置,
  默认筛选器列表,
  默认退化配置,
} from "../src/index.js";

const starter: StarterType = {
  name: "测试方案",
  data: "表形码六分类",
  keyboard: "虎码",
  encoder: "双编形码（星陈）",
};

describe("方案模板", () => {
  it("创建及编辑方案不会修改示例或后续创建的配置", () => {
    const template = 读取内置方案模板();
    const first = template.createConfig(starter);
    const untouched = structuredClone(first);
    first.form.mapping.额外字根 = "z";
    first.analysis!.classifier!.横 = 99;
    first.analysis!.degenerator!.no_cross = true;
    first.analysis!.selector!.push("额外筛选器");
    first.encoder.sources.s0!.next = null;
    template.defaultConfig.form.mapping.默认配置改动 = "a";
    expect(template.createConfig(starter)).toEqual(untouched);
    expect(读取示例配置("huma").form.mapping).not.toHaveProperty("额外字根");
    expect(默认退化配置.no_cross).toBe(false);
    expect(默认筛选器列表).not.toContain("额外筛选器");
  });

  it("补全笔画只写入新配置，调用方修改输入示例也不会改变私有预设", () => {
    const ids = [
      "snow4",
      "longma",
      "jdh",
      "shouyou",
      "xkjd",
      "cqkm",
      "bxm",
      "mswb",
      "ziyuan",
      "easy",
      "huma",
      "tianma",
      "sapphire",
      "xuma",
      "yustar",
      "yujoy",
      "zhangma",
      "zhengma",
      "zhenma",
    ] as const;
    const examples = Object.fromEntries(
      ids.map((id) => [id, 读取示例配置(id)]),
    ) as Record<(typeof ids)[number], ReturnType<typeof 读取示例配置>>;
    examples.huma.form.mapping = {};
    const original = structuredClone(examples);
    const template = 创建方案模板(examples);
    const config = template.createConfig(starter);
    expect(Object.keys(config.form.mapping).length).toBeGreaterThan(0);
    expect(examples).toEqual(original);
    examples.huma.form.alphabet = "z";
    examples.yustar.encoder.max_length = 99;
    examples.bxm.analysis!.classifier!.横 = 99;
    expect(template.createConfig(starter)).toEqual(config);
    expect(
      template.createConfig({ ...starter, keyboard: "无" }).form.mapping,
    ).not.toHaveProperty("额外字根");
  });
});
