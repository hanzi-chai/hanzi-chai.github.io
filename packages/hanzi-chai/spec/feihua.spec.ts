import { describe, expect, it } from "bun:test";
import {
  分析方案,
  准备方案,
  构建字库,
  最小方案,
  type 配置,
  type 基本字形数据,
  type 字符数据,
} from "../src/index.js";

const 横部件 = (id: number, count: number): 基本字形数据 => ({
  id,
  type: "component",
  operator: undefined,
  references: undefined,
  ambiguous: false,
  strokes: Array.from({ length: count }, (_, i) => ({
    feature: "横",
    start: [10, 15 + i * 25],
    curveList: [{ command: "h", parameterList: [80] }],
  })),
});
const 复合 = (id: number, ids: number[]): 基本字形数据 => ({
  id,
  type: "compound",
  operator: "⿱",
  ambiguous: false,
  references: ids.map((id) => ({ id })),
});
function 上下文(配置: 配置, 字形: 基本字形数据[], 字符: string, id: number) {
  const 字符表: 字符数据[] = [
    {
      unicode: 字符.codePointAt(0)!,
      tygf: 1,
      glyphs: [{ id, sources: ["G"] }],
    },
  ];
  return 准备方案(配置, {
    字库: 构建字库(配置, 字符表, 字形),
    原始词典: [{ 词: 字符, 拼音: ["gong1"], 频率: 1 }],
  });
}
function 配置() {
  const c = structuredClone(最小方案);
  c.analysis = {
    component_analyzer: "冰雪飞花",
    compound_analyzer: "冰雪飞花",
    fusion: false,
    selector: ["根少优先", "全符笔顺", "取大优先"],
  };
  c.form = { alphabet: "aeb", mapping: { "1": "e", "字形-2": "b" } };
  return c;
}
const 名称 = (x: any) => x.字根序列.map((根: any) => 根.获取名称());
function 对照(c: 配置, 字形: 基本字形数据[], 字符 = "三", id = 3) {
  const ctx = 上下文(c, 字形, 字符, id);
  const 静态 = 分析方案(ctx);
  if (静态.dynamic) throw new Error("应为静态分析");
  const 静 = 静态.value.分析结果.values().next().value![0]!;
  ctx.配置.analysis!.dynamic = true;
  const 动 = 分析方案(ctx).value.分析结果.values().next().value![0]! as any;
  const 映射 = new Map([...ctx.线性化决策].map(([k, v]) => [k.获取名称(), v]));
  const 选择 = (列表: any) =>
    [...列表].find((x: any) =>
      x.条件列表.every((条件: any) =>
        条件.value === null
          ? (条件.op === "不是") === 映射.has(条件.element)
          : (条件.op === "是") ===
            /^[aoeiuv;/]$/.test(映射.get(条件.element) ?? ""),
      ),
    );
  const 首选 = 选择(动);
  expect(首选).toBeDefined();
  expect(名称(首选)).toEqual(名称(静));
  if ("全集合字根序列" in 静) {
    expect(首选.全集合字根序列.map((根: any) => 根.获取名称())).toEqual(
      (静.全集合字根序列 as any[]).map((根) => 根.获取名称()),
    );
    expect(静).toHaveProperty("全集合当前拆分方式", 首选.全集合当前拆分方式);
  }
  return { 静, 首选, 选择, ctx };
}

describe("冰雪飞花静态与动态规则", () => {
  it("多根全集合回退不得混入扩展字根", () => {
    const { 静 } = 对照(配置(), [横部件(2, 2), 横部件(3, 3)]);
    expect(名称(静)).toEqual(["1", "1", "1"]);
  });
  it.each([
    "b",
    "e",
    undefined,
  ])("字根跨集合或不选取时仍有一致回退：%s", (键) => {
    const c = 配置();
    if (键) c.form.mapping["字形-2"] = 键;
    else delete c.form.mapping["字形-2"];
    c.form.mapping_space = {
      "字形-2": [
        { value: "b", score: 0 },
        { value: "e", score: 0 },
        { value: null, score: 0 },
      ],
    };
    对照(c, [横部件(2, 2), 横部件(3, 3)]);
  });
  it.each([
    "b",
    "e",
    undefined,
  ])("可选复合体正根继续回退且随布局一致：%s", (键) => {
    const c = 配置();
    if (键) c.form.mapping["字形-10"] = 键;
    else delete c.form.mapping["字形-10"];
    c.form.mapping_space = {
      "字形-10": [
        { value: "b", score: 0 },
        { value: "e", score: 0 },
        { value: null, score: 0 },
      ],
    };
    对照(
      c,
      [横部件(1, 1), 横部件(2, 2), 复合(10, [1, 2]), 复合(11, [10, 1])],
      "功",
      11,
    );
  });
  it("兼容取码按字符解析出的字形生效，并保留常规取根", () => {
    const c = 配置();
    const { 静, 首选 } = 对照(
      c,
      [横部件(1, 1), 横部件(2, 2), 复合(11, [2, 1])],
      "功",
      11,
    );
    expect(名称(静)[0]).toBe("1");
    expect((静 as any).常规字根序列[0].获取名称()).toBe("字形-2");
    expect(首选.常规字根序列[0].获取名称()).toBe("字形-2");
  });
  it("准包围由 glyph_algebra 改写，分析器仅按包围结构处理", () => {
    const c = 配置();
    // 外部三横不是字根；内部二横是根。普通上下规则会取内部，
    // 改为包围后仍应选择内部；不依赖任何硬编码字形 ID。
    c.data!.glyph_algebra = [
      {
        from: { operator: "⿱", references: [3, 2] },
        to: { operator: "⿵", references: [3, 2] },
      },
    ];
    const { 静 } = 对照(
      c,
      [横部件(2, 2), 横部件(3, 3), 复合(11, [3, 2])],
      "营",
      11,
    );
    expect((静 as any).复合体.结构描述字符).toBe("⿵");
    expect(名称(静)[0]).toBe("字形-2");
  });
});
