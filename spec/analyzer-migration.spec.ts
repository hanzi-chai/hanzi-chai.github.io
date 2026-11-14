import { describe, expect, it } from "bun:test";
import {
  准备方案,
  分析方案,
  type 基本字形数据,
  type 复合体数据,
  type 字符数据,
  最小方案,
  本地编码评估,
  type 条件,
  构建字库,
  获取默认目标,
  运行方案,
  type 配置,
  首末取大复合体分析器,
  首末取大部件分析器,
} from "../src/index.js";

const 复合 = (
  id: number,
  operator: "⿰" | "⿱" | "⿲" | "⿶" | "⿵",
  ids: number[],
): 复合体数据 => ({
  id,
  type: "compound",
  operator,
  references: ids.map((id) => ({ id })),
});
const 字形: 基本字形数据[] = [
  ...[1, 2, 3].map(
    (id): 基本字形数据 => ({
      id,
      type: "component",
      operator: undefined,
      references: undefined,
      strokes: Array.from({ length: id }, (_, i) => ({
        feature: "横",
        start: [10, 15 + i * 25],
        curveList: [{ command: "h", parameterList: [80] }],
      })),
    }),
  ),
  复合(10, "⿰", [2, 1]),
  复合(11, "⿱", [1, 3]),
  复合(12, "⿶", [3, 2]),
  复合(13, "⿲", [1, 10, 3]),
  复合(14, "⿱", [10, 11]),
  复合(15, "⿰", [11, 10]),
  复合(16, "⿵", [10, 11]),
  复合(17, "⿱", [10, 10]),
  {
    ...复合(18, "⿱", [3, 1]),
    strokes: [
      { index: 0, from: 0, to: 0 },
      { index: 1 },
      { index: 0, from: 1, to: 2 },
    ],
  },
];
const 字符表: 字符数据[] = [..."口三甲乙丙丁戊己庚功辛"].map((字, i) => ({
  unicode: 字.codePointAt(0)!,
  tygf: 1,
  glyphs: [
    { id: [2, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18][i]!, sources: ["G"] },
  ],
}));
const 可选根 = ["字形-00002", "字形-0000a", "字形-0000b"];
const 分析器组合 = [
  ["默认", "默认"],
  ["默认", "首右"],
  ["默认", "真码"],
  ["默认", "星空键道"],
  ["二笔", "二笔"],
  ["张码", "张码"],
  ["逸码", "逸码"],
  ["冰雪飞花", "冰雪飞花"],
] as const;

function 上下文(
  部件: string,
  复合体: string,
  状态: number[],
  dynamic: boolean,
  修改?: (配置: 配置) => void,
) {
  const 配置 = structuredClone(最小方案);
  配置.data!.fusion = false;
  配置.analysis = {
    component_analyzer: 部件,
    compound_analyzer: 复合体,
    dynamic,
    selector: ["根少优先", "全符笔顺", "取大优先"],
  };
  配置.form = {
    alphabet: "abcde",
    mapping: { "1": "e", "10": "e", "11": "e" },
    mapping_space: {},
  };
  可选根.forEach((根, i) => {
    if (状态[i]) 配置.form.mapping[根] = 状态[i] === 1 ? "b" : "e";
    配置.form.mapping_space![根] = [
      { value: "b", score: 0 },
      { value: "e", score: 0 },
      { value: null, score: 0 },
    ];
  });
  修改?.(配置);
  return 准备方案(配置, {
    字库: 构建字库(配置, 字符表, 字形),
    原始词典: 字符表.map((x) => ({
      词: String.fromCodePoint(x.unicode),
      拼音: ["yi1"],
      频率: 1,
    })),
  });
}

function 判断(状态: number[]) {
  return (条件: 条件) => {
    const index = 可选根.indexOf(条件.element);
    expect(index).toBeGreaterThanOrEqual(0);
    const 相等 = 条件.value === null ? 状态[index] === 0 : 状态[index] === 2;
    return 条件.op === "是" ? 相等 : !相等;
  };
}

describe("全部分析器共用静态与动态规则", () => {
  it("未注册的首末取大也共用执行器，正序和逆序候选不会混用缓存", () => {
    const 准备 = (状态: number[]) => {
      const ctx = 上下文("默认", "默认", 状态, false, (配置) => {
        配置.analysis!.selector = ["根少优先", "首末取大"];
      });
      const {
        分析配置,
        决策,
        决策空间,
        线性化决策,
        自定义分析映射,
        动态自定义分析映射,
      } = ctx.字形分析配置;
      const 如配置 = ctx.字库.准备字形分析配置(
        分析配置,
        决策,
        决策空间,
        线性化决策,
        自定义分析映射,
        动态自定义分析映射,
      );
      if (!如配置.ok) throw 如配置.error;
      return {
        部件: new 首末取大部件分析器(如配置.value),
        复合体: new 首末取大复合体分析器(如配置.value),
        ...ctx.字库.获取待分析部件和复合体集合(ctx.汉字集合),
      };
    };
    const 动态 = 准备([0, 0, 0]);
    for (const 字形 of 动态.待分析部件集合) {
      const 结果 = 动态.部件.动态分析(字形);
      if (!结果.ok) throw 结果.error;
      动态.复合体.动态部件分析结果.set(字形, 结果.value);
    }
    const 动态结果 = [...动态.待分析复合体集合].map((字形) => {
      const 结果 = 动态.复合体.动态分析(字形);
      if (!结果.ok) throw 结果.error;
      return [字形.id, 结果.value] as const;
    });
    for (let mask = 0; mask < 8; mask++) {
      const 状态 = [0, 1, 2].map((i) => (mask >> i) & 1);
      const 静态 = 准备(状态);
      for (const 字形 of 静态.待分析部件集合) {
        const 结果 = 静态.部件.分析(字形);
        if (!结果.ok) throw 结果.error;
        静态.复合体.部件分析结果.set(字形, 结果.value);
        const 候选 = [...动态.复合体.动态部件分析结果].find(
          ([x]) => x.id === 字形.id,
        )![1];
        const { 条件列表, ...选中 } = [...候选].find((项) =>
          项.条件列表.every(判断(状态)),
        )!;
        expect(选中).toEqual(结果.value);
      }
      for (const 字形 of 静态.待分析复合体集合) {
        const 结果 = 静态.复合体.分析(字形);
        if (!结果.ok) throw 结果.error;
        const 候选 = 动态结果.find(([id]) => id === 字形.id)![1];
        const { 条件列表, ...选中 } = [...候选].find((项) =>
          项.条件列表.every(判断(状态)),
        )!;
        expect(选中).toEqual(结果.value);
      }
    }
  });

  for (const [部件, 复合体] of 分析器组合) {
    it(`${部件}／${复合体}：完整分析对象在全部字根组合下一致`, () => {
      const 动态 = 分析方案(上下文(部件, 复合体, [0, 0, 0], true));
      if (!动态.dynamic) throw new Error("应为动态分析");
      const 基数 = 部件 === "冰雪飞花" ? 3 : 2;
      for (let mask = 0; mask < 基数 ** 3; mask++) {
        const 状态 = [0, 1, 2].map((i) => Math.floor(mask / 基数 ** i) % 基数);
        const 静态 = 分析方案(上下文(部件, 复合体, 状态, false));
        if (静态.dynamic) throw new Error("应为静态分析");
        for (const 字段 of ["部件分析结果", "复合体分析结果"] as const) {
          for (const [字形, 候选] of 动态.value[字段]) {
            const 匹配 = [...候选].find((项) => 项.条件列表.every(判断(状态)));
            expect(匹配).toBeDefined();
            const { 条件列表, ...结果 } = 匹配!;
            const 静态结果 = [...静态.value[字段]].find(
              ([x]) => x.id === 字形.id,
            )![1];
            expect(结果).toEqual(静态结果);
          }
        }
      }
    });
  }

  it("张码、逸码、真码、星空键道的新增动态结果能通过完整编码管道", () => {
    for (const [部件, 复合体] of 分析器组合.filter(
      ([, x]) => x !== "冰雪飞花",
    )) {
      for (const 状态 of [
        [0, 0, 0],
        [1, 0, 1],
        [1, 1, 1],
      ]) {
        const 编码 = (dynamic: boolean) => {
          const ctx = 上下文(部件, 复合体, 状态, dynamic);
          return 本地编码评估(
            运行方案(ctx).输入,
            获取默认目标(ctx.配置.encoder),
          )[0];
        };
        expect(编码(true)).toEqual(编码(false));
      }
    }
  });

  it("张码和逸码复用默认自定义拆分，动态候选保留补码等附加信息", () => {
    for (const 部件 of ["张码", "逸码"]) {
      const 修改 = (配置: 配置) => {
        配置.analysis!.customize = { "字形-00003": ["1", "1"] };
        配置.analysis!.dynamic_customize = {
          "字形-00003": [
            ["字形-00002", "1"],
            ["1", "1"],
          ],
        };
      };
      const 动态 = 分析方案(上下文(部件, 部件, [0, 0, 0], true, 修改));
      if (!动态.dynamic) throw new Error("应为动态分析");
      const 候选 = [...动态.value.部件分析结果].find(([x]) => x.id === 3)![1];
      for (const 存在 of [0, 1]) {
        const 静态 = 分析方案(
          上下文(部件, 部件, [存在, 0, 0], false, (配置) => {
            修改(配置);
            配置.analysis!.customize!["字形-00003"] = 存在
              ? ["字形-00002", "1"]
              : ["1", "1"];
          }),
        );
        if (静态.dynamic) throw new Error("应为静态分析");
        const 匹配 = [...候选].find((项) =>
          项.条件列表.every(判断([存在, 0, 0])),
        )!;
        const 结果 = [...静态.value.部件分析结果].find(([x]) => x.id === 3)![1];
        const { 条件列表, ...动态结果 } = 匹配;
        // 被覆盖拆分方式仅用于静态调试，动态候选从未承诺该字段。
        const { 被覆盖拆分方式, ...静态结果 } = 结果 as typeof 结果 & {
          被覆盖拆分方式?: unknown;
        };
        expect(动态结果).toEqual(静态结果);
      }
    }
  });
});
