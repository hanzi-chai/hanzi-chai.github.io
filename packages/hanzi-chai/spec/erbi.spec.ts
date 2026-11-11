import { describe, expect, it } from "bun:test";
import {
  分析方案,
  准备方案,
  创建静态分析环境,
  构建字库,
  最小方案,
  获取默认目标,
  本地编码评估,
  运行方案,
  type 基本字形数据,
  type 字符数据,
} from "../src/index.js";

const 复合 = (id: number, ids: number[]): 基本字形数据 => ({
  id,
  type: "compound",
  operator: ids.length === 3 ? "⿳" : "⿱",
  references: ids.map((id) => ({ id })),
  ambiguous: false,
});
const 字形: 基本字形数据[] = [
  ...[1, 2].map(
    (id): 基本字形数据 => ({
      id,
      type: "component",
      operator: undefined,
      references: undefined,
      ambiguous: false,
      strokes: Array.from({ length: id === 1 ? 1 : 3 }, (_, i) => ({
        feature: "横",
        start: [10, 15 + i * 25],
        curveList: [{ command: "h", parameterList: [80] }],
      })),
    }),
  ),
  复合(10, [2, 1]),
  复合(11, [1, 2]),
  复合(20, [10, 11]),
  复合(21, [1, 10, 11]),
  复合(22, [10, 10]),
  复合(23, [1, 2]),
  复合(24, [23, 20]),
  复合(25, [1, 2]),
];
const 字符表: 字符数据[] = [..."甲乙丙丁戊己"].map((字符, i) => ({
  unicode: 字符.codePointAt(0)!,
  tygf: 1,
  glyphs: [{ id: 20 + i, sources: ["G"] }],
}));
const 可选根 = [2, 10, 11, 20].map((id) => `字形-${id}`);

function 上下文(mask: number, dynamic: boolean) {
  const 配置 = structuredClone(最小方案);
  配置.analysis = {
    component_analyzer: "二笔",
    compound_analyzer: "二笔",
    fusion: false,
    dynamic,
  };
  配置.form = {
    alphabet: "abcdefghij",
    mapping: { "1": "a", "10": "b", "11": "c", "字形-23": "d" },
    mapping_space: {},
  };
  可选根.forEach((根, i) => {
    const 键 = "efgh"[i]!;
    if (mask & (1 << i)) 配置.form.mapping[根] = 键;
    配置.form.mapping_space![根] = [
      { value: 键, score: 0 },
      { value: null, score: 0 },
    ];
  });
  return 准备方案(配置, {
    字库: 构建字库(配置, 字符表, 字形),
    原始词典: [..."甲乙丙丁戊己"].map((词) => ({ 词, 拼音: ["yi1"], 频率: 1 })),
  });
}

describe("二笔共享分析规则", () => {
  it("全部 16 种字根选择下，自动推导结果与完整静态结果一致", () => {
    // 动态分析只生成一次，不能随待验证的当前配置重新生成候选。
    const 动态 = 分析方案(上下文(0, true));
    if (!动态.dynamic) throw new Error("应为动态分析");
    const 全选动态 = 分析方案(上下文(15, true));
    expect(全选动态).toEqual(动态);
    for (let mask = 0; mask < 16; mask++) {
      const 静态 = 分析方案(上下文(mask, false));
      if (静态.dynamic) throw new Error("应为静态分析");
      const 环境 = 创建静态分析环境((条件) => {
        expect(条件.value).toBeNull();
        const i = 可选根.indexOf(条件.element);
        expect(i).toBeGreaterThanOrEqual(0);
        const 存在 = !!(mask & (1 << i));
        return 条件.op === "不是" ? 存在 : !存在;
      });
      for (const [字形, 候选] of 动态.value.复合体分析结果) {
        const 匹配 = [...候选].find((项) => 项.条件列表.every(环境.判断));
        expect(匹配).toBeDefined();
        const { 条件列表, ...推导结果 } = 匹配!;
        const 静态结果 = [...静态.value.复合体分析结果].find(
          ([x]) => x.id === 字形.id,
        )![1];
        // 比较整个分析对象，包括复合体、字根对象及其笔画信息。
        expect(推导结果).toEqual(静态结果);
      }
    }
  });

  it("保留三分、第二部拆分、重复子形、整根和部件末笔规则", () => {
    const 静态 = 分析方案(上下文(0, false));
    if (静态.dynamic) throw new Error("应为静态分析");
    const 序列 = new Map(
      [...静态.value.复合体分析结果].map(([字形, 分析]) => [
        字形.id,
        分析.字根序列.map((根) => 根.获取名称()),
      ]),
    );
    expect(序列.get(20)).toEqual(["11", "10", "11"]);
    expect(序列.get(21)).toEqual(["10", "11", "10"]);
    expect(序列.get(22)).toEqual(["11", "11", "10"]);
    expect(序列.get(23)).toEqual(["字形-23"]);
    expect(序列.get(24)).toEqual(["字形-23", "11", "10"]);
    expect(序列.get(25)).toEqual(["10", "11", "1"]);
  });

  it("完整编码管道正确消费推导出的优先表", () => {
    for (let mask = 0; mask < 16; mask++) {
      const 编码 = (dynamic: boolean) => {
        const ctx = 上下文(mask, dynamic);
        const 运行 = 运行方案(ctx);
        return 本地编码评估(运行.输入, 获取默认目标(ctx.配置.encoder))[0];
      };
      expect(编码(true)).toEqual(编码(false));
    }
  });
});
