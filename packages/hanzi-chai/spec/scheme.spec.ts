import { describe, expect, it } from "bun:test";
import {
  分析拼音,
  合并拼写运算,
  构建强类型决策与决策空间,
  构建强类型自定义分析,
  决策图,
  合并分类器,
  计算全部合法元素与元素映射,
  计算拼音分析与元素映射,
  序列化组装结果,
  添加优先简码,
  组装,
  动态组装,
  下转换,
  构建优先简码映射,
  获取默认目标,
  本地编码评估,
  运行方案,
  校验方案配置,
  检查方案元素,
  解释取码,
  解释拆分,
  构建字库,
  准备方案,
  解析自定义拆分部件,
} from "../src/index.js";
import {
  fixtureConfig,
  fixtureContext,
  glyphs,
  characters,
  dictionary,
} from "./fixtures/scheme.js";

describe("完整方案运行", () => {
  it("自定义拆分支持字符、字形名称及旧版数字 ID", () => {
    for (const key of ["二", "字形-2", "2"]) {
      const config = fixtureConfig();
      config.analysis = { customize: { [key]: ["1"] } };
      const context = fixtureContext(config);
      expect(检查方案元素(context)).toEqual([]);
      const run = 运行方案(context);
      const [codes] = 本地编码评估(run.输入, 获取默认目标(config.encoder));
      expect(codes.find((x) => x.词 === "二")?.全码).toBe("a");
    }
  });

  it("动态自定义拆分采用相同的名称解析", () => {
    for (const key of ["二", "字形-2", "2"]) {
      const config = fixtureConfig();
      config.analysis = {
        dynamic: true,
        dynamic_customize: { [key]: [["1"], ["1", "1"]] },
      };
      const context = fixtureContext(config);
      expect(检查方案元素(context)).toEqual([]);
      const run = 运行方案(context);
      expect(
        run.词列表
          .find((x) => x.词 === "二")!
          .全部元素序列.map((x) => x.元素序列.length),
      ).toEqual([1, 2]);
      expect(
        本地编码评估(run.输入, 获取默认目标(config.encoder))[0].find(
          (x) => x.词 === "二",
        )?.全码,
      ).toBe("a");
    }
  });

  it("字符作用于选定来源的全部部件字形，具体字形优先覆盖", () => {
    const config = fixtureConfig();
    config.data!.glyph_sources = ["G", "H"];
    // 具体字形写在字符规则之前，也应优先于字符规则。
    config.analysis = { customize: { "字形-2": ["1"], 二: ["1", "1"] } };
    const parts = [...glyphs, { ...glyphs[1]!, id: 3 }];
    const chars = characters.map((x) =>
      x.unicode === "二".codePointAt(0)
        ? { ...x, glyphs: [...x.glyphs, { id: 3, sources: ["H"] }] }
        : x,
    );
    const repertoire = 构建字库(config, chars, parts);
    const context = 准备方案(config, {
      字库: repertoire,
      原始词典: dictionary,
    });
    const resolve = (key: string) =>
      解析自定义拆分部件(repertoire, context.名称映射, key).map((x) => x.id);
    expect(resolve("二")).toEqual([2, 3]);
    expect(resolve("字形-3")).toEqual([3]);
    const map = context.字形分析配置.自定义分析映射;
    expect(
      [...map].map(([part, roots]) => [
        part.id,
        roots.map((x) => x.获取名称()),
      ]),
    ).toEqual([
      [2, ["1"]],
      [3, ["1", "1"]],
    ]);
    config.data!.glyph_sources = ["G"];
    const onlyG = 准备方案(config, {
      字库: 构建字库(config, chars, parts),
      原始词典: dictionary,
    });
    expect(
      解析自定义拆分部件(onlyG.字库, onlyG.名称映射, "二").map((x) => x.id),
    ).toEqual([2]);
  });

  it("自定义目标必须能解析到部件，并提供配置路径诊断", () => {
    const config = fixtureConfig();
    config.analysis = {
      customize: { "字形-999": ["1"], 不存在: ["1"] },
      dynamic_customize: { "字音-未知": [["1"]] },
    };
    const diagnostics = 检查方案元素(fixtureContext(config));
    expect(diagnostics.map((x) => x.path)).toEqual([
      "/analysis/customize/字形-999",
      "/analysis/customize/不存在",
      "/analysis/dynamic_customize/字音-未知",
    ]);
    expect(diagnostics.every((x) => x.code === "UNKNOWN_GLYPH")).toBe(true);
  });
  it("与前端分阶段流程产生相同的拆分、组装和序列化输入", () => {
    const config = fixtureConfig();
    config.encoder.rules = [{ length_equal: 2, formula: "AaBa" }];
    const context = fixtureContext(config);
    const 字库 = context.字库;
    const 词典 = 字库.校验词典(context.数据.原始词典);
    const 过滤词典 = 字库.过滤词典(词典, "general");
    const { 拼音分析映射, 拼音元素映射 } = 计算拼音分析与元素映射(
      词典,
      合并拼写运算(config.algebra),
    );
    const { 名称映射 } = 计算全部合法元素与元素映射(
      [...字库].map(([, x]) => x.character),
      [...字库.字形迭代器()].map(([, x]) => x),
      合并分类器(config.analysis?.classifier),
      拼音元素映射,
      new Map(),
    );
    const { 决策, 决策空间 } = 构建强类型决策与决策空间(
      config.form.mapping,
      {},
      名称映射,
    );
    const linear = new 决策图(决策).线性化();
    if (!linear.ok) throw linear.error;
    const analysis = 字库.分析(
      {
        决策,
        决策空间,
        线性化决策: linear.value,
        分析配置: config.analysis ?? {},
        字形来源列表: ["G"],
        ...构建强类型自定义分析(字库, 名称映射, {}, {}),
      },
      字库.获取汉字集合(过滤词典),
    );
    if (!analysis.ok) throw analysis.error;
    const result = 组装(
      {
        决策,
        决策空间,
        线性化决策: linear.value,
        最大码长: config.encoder.max_length,
        源映射: config.encoder.sources,
        条件映射: config.encoder.conditions,
        构词规则列表: config.encoder.rules!,
        键盘配置: config.form,
        分类器: 合并分类器(),
        自定义分析映射: new Map(),
        来源列表: ["G"],
      },
      分析拼音(拼音分析映射, 过滤词典),
      analysis.value,
    );
    if (!result.ok) throw result.error;
    // 保留原前端序列化算法作为独立参照，避免只比较同一个新封装。
    const expected = result.value.map(({ 词, 元素序列, 频率 }) => ({
      词: 词.map((x) => x.获取名称()).join(""),
      频率,
      全部元素序列: [{ 元素序列: 元素序列.元素序列.map(下转换), 条件列表: [] }],
    }));
    expect(运行方案(context).词列表).toEqual(expected);
    const [codes] = 本地编码评估(
      运行方案(context).输入,
      获取默认目标(config.encoder),
    );
    expect(codes.find((x) => x.词 === "一")?.全码).toBe("a");
    expect(codes.find((x) => x.词 === "二")?.全码).toBe("aa");
    expect(codes.find((x) => x.词 === "一二")?.全码).toBe("aa");
  });

  it("未配置构词时跳过多字词；静态和动态分析都可编码", () => {
    const config = fixtureConfig();
    const staticRun = 运行方案(fixtureContext(config));
    expect(staticRun.词列表.map((x) => x.词)).toEqual(["一", "二"]);
    config.analysis = { dynamic: true };
    const context = fixtureContext(config);
    const dynamicRun = 运行方案(context);
    expect(dynamicRun.分析.dynamic).toBe(true);
    const assembled = 动态组装(
      context.组装配置,
      context.拼音分析结果,
      dynamicRun.分析.value as Parameters<typeof 动态组装>[2],
    );
    if (!assembled.ok) throw assembled.error;
    expect(dynamicRun.词列表).toEqual(
      序列化组装结果(添加优先简码(assembled.value, new Map())),
    );
    expect(
      本地编码评估(dynamicRun.输入, 获取默认目标(config.encoder))[0],
    ).toEqual(本地编码评估(staticRun.输入, 获取默认目标(config.encoder))[0]);
  });

  it("优先简码包含缺字时整体忽略，不误作用于其他词", () => {
    const context = fixtureContext();
    const map = 构建优先简码映射(context.字库, [
      { word: "一不存在", sources: [["yi1"]], level: 1 },
    ]);
    expect(map.size).toBe(0);
    context.配置.encoder.short_code_list = [
      { word: "一", sources: [["yi1"]], level: 1 },
    ];
    const next = fixtureContext(context.配置);
    expect(运行方案(next).词列表.find((x) => x.词 === "一")?.简码长度).toBe(1);
  });

  it("动态分析保留可选字根的条件和备用拆分", () => {
    const config = fixtureConfig();
    config.analysis = { dynamic: true };
    config.form.mapping["二"] = "b";
    config.form.mapping_space = {
      二: [
        { value: "b", score: 0 },
        { value: null, score: 0 },
      ],
    };
    const run = 运行方案(fixtureContext(config));
    const entry = run.词列表.find((x) => x.词 === "二")!;
    expect(entry.全部元素序列).toEqual([
      {
        元素序列: [{ element: "二", index: 0 }],
        条件列表: [{ element: "二", op: "不是", value: null }],
      },
      {
        元素序列: [
          { element: "1", index: 0 },
          { element: "1", index: 0 },
        ],
        条件列表: [],
      },
    ]);
    expect(
      本地编码评估(run.输入, 获取默认目标(config.encoder))[0].find(
        (x) => x.词 === "二",
      )?.全码,
    ).toBe("b");
  });

  it("解释候选筛选与取码条件分支，且不改变编码", () => {
    const config = fixtureConfig();
    config.encoder.sources.s1!.next = "c0";
    config.encoder.conditions.c0 = {
      object: { type: "字根", rootIndex: 2 },
      operator: "存在",
      positive: "s2",
      negative: null,
    };
    const context = fixtureContext(config);
    const run = 运行方案(context);
    const trace = 解释取码(context, run.分析, "一二");
    expect(JSON.stringify(trace)).toContain('"matched":false');
    expect(JSON.stringify(trace)).toContain('"matched":true');
    expect(
      解释拆分(context, "二").characters[0]!.analyses.length,
    ).toBeGreaterThan(0);
    expect(运行方案(context).词列表).toEqual(run.词列表);
  });

  it("拒绝未注册组件、缺失节点及循环取码图", () => {
    const config = fixtureConfig();
    expect(() =>
      校验方案配置({ ...config, form: { mapping: { "1": null } } }),
    ).toThrow("mapping_space");
    config.analysis = { selector: ["不存在"] };
    expect(() => 校验方案配置(config)).toThrow("未注册的筛选器");
    config.analysis = {};
    config.encoder.sources.s1!.next = "s1";
    expect(() => 校验方案配置(config)).toThrow("循环引用");
    config.encoder.sources.s1!.next = "s999";
    expect(() => 校验方案配置(config)).toThrow("节点不存在");
  });

  it("归并循环及非法自定义字形提供可定位错误", () => {
    const config = fixtureConfig();
    config.form.mapping["1"] = { element: "2" };
    config.form.mapping["2"] = { element: "1" };
    expect(() => fixtureContext(config)).toThrow("循环依赖");
    const other = fixtureConfig();
    other.analysis = { customize: { "999": ["不存在"] } };
    const diagnostics = 检查方案元素(fixtureContext(other));
    expect(diagnostics.map((x) => x.code)).toEqual([
      "UNKNOWN_GLYPH",
      "UNKNOWN_ELEMENT",
    ]);
    expect(diagnostics[0]!.path).toBe("/analysis/customize/999");
  });
});
