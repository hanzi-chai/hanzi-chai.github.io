import { describe, expect, it } from "bun:test";
import {
  下转换,
  估计阶重码,
  type 元素,
  分析原始重码,
  分析边际重码,
  字符,
  type 强类型元素位或编码,
  type 强类型决策,
  type 强类型非空安排,
  归并组装结果,
  笔画,
  筛选组装结果,
  type 组装条目,
} from "../src/index.js";

const a = 笔画.创建(1),
  b = 笔画.创建(2),
  c = 笔画.创建(3);
const 位 = (element: typeof a, index = 0) => ({ element, index });
const 项 = (词: string, 序列: 强类型元素位或编码[], 频率 = 1): 组装条目 => ({
  词: [...词].map((字) => {
    const result = 字符.从码位创建(字.codePointAt(0)!);
    if (!result.ok) throw result.error;
    return result.value;
  }),
  拼音来源列表: [],
  频率,
  元素序列: { 元素序列: 序列, sources: [] },
});
const 配置 = { type: "single" as const, position: [0, 1], top: 0 };
const 条目 = [
  项("甲", [位(a), 位(c)], 40),
  项("乙", [位(a), 位(c)], 30),
  项("丙", [位(b), 位(c)], 20),
  项("丁", [位(a)], 10),
];

describe("元素离散性分析", () => {
  it("零阶保留完整元素位和短序列空位，计算非首项数", () => {
    const groups = 分析原始重码(配置, 条目, 2);
    expect([...groups.values()]).toEqual([["甲", "乙"], ["丙"], ["丁"]]);
    expect(JSON.parse([...groups.keys()][2]!)[1]).toBe("ε");
    expect(估计阶重码(groups, 0, 30)).toBe(1);
  });
  it("一阶投影保留前端均匀分配估计，并把未选码位变为通配符", () => {
    const groups = 分析原始重码({ ...配置, position: [1] }, 条目, 2);
    expect([...groups.values()]).toEqual([["甲", "乙", "丙"], ["丁"]]);
    expect(JSON.parse([...groups.keys()][0]!)[0]).toBe("*");
    expect(估计阶重码(groups, 1, 30)).toBeCloseTo(10 / 60);
  });
  it("频率范围和词长过滤不修改输入或原有顺序", () => {
    const input = [条目[3]!, 项("甲乙", [位(a)], 100), 条目[0]!];
    expect(筛选组装结果(input, { ...配置, top: 1 })[0]).toBe(条目[0]);
    expect(筛选组装结果(input, { ...配置, type: "multi" })[0]!.词).toHaveLength(
      2,
    );
    expect(input[0]).toBe(条目[3]);
  });
  it("元素码位索引不同不会被当成零阶重码", () => {
    const groups = 分析原始重码(
      配置,
      [项("甲", [位(a)]), 项("乙", [位(a, 1)])],
      2,
    );
    expect(groups.size).toBe(2);
  });
  it("边际合并只返回新进入重码组的字，保留已有重码字", () => {
    const result = 分析边际重码(配置, 条目, 2, [[位(a), 位(b)]]);
    expect(result.新增对象).toEqual(["丙"]);
    expect([...result.合并分布.values()]).toEqual([["甲", "乙", "丙"], ["丁"]]);
    expect([...result.原始分布.values()][0]).toEqual(["甲", "乙"]);
  });
  it("重叠合并组沿用前端优先匹配第一组的规则", () => {
    const groups = 分析原始重码(
      配置,
      [项("甲", [位(a)]), 项("乙", [位(b)]), 项("丙", [位(c)])],
      2,
      [
        [位(a), 位(b)],
        [位(b), 位(c)],
      ],
    );
    expect([...groups.values()]).toEqual([["甲", "乙"], ["丙"]]);
  });
  it("只解析显式归并和元素位引用，不合并碰巧同键的元素", () => {
    const decisions: 强类型决策 = new Map<元素, 强类型非空安排>([
      [a, { element: b }],
      [b, [位(c, 1)]],
      [c, "aa"],
    ]);
    const input = [项("甲", [位(a)]), 项("乙", [位(c, 1)]), 项("丙", [位(c)])];
    const merged = 归并组装结果(input, decisions);
    expect(merged.map((x) => x.元素序列.元素序列.map(下转换))).toEqual([
      [{ element: "3", index: 1 }],
      [{ element: "3", index: 1 }],
      [{ element: "3", index: 0 }],
    ]);
    expect(分析原始重码(配置, merged, 2).size).toBe(2);
    expect(input[0]!.元素序列.元素序列[0]).toEqual(位(a));
    expect(
      分析原始重码(
        配置,
        归并组装结果(
          [项("甲", [位(a)]), 项("乙", [位(b)])],
          new Map([
            [a, "a"],
            [b, "a"],
          ]),
        ),
        2,
      ).size,
    ).toBe(2);
  });
  it("无安排立即停止，归并循环给出错误", () => {
    expect(
      归并组装结果([项("甲", [位(a)])], new Map())[0]!.元素序列.元素序列,
    ).toEqual([位(a)]);
    expect(() =>
      归并组装结果(
        [项("甲", [位(a)])],
        new Map([
          [a, { element: b }],
          [b, { element: a }],
        ]),
      ),
    ).toThrow("归并循环");
  });
  it("按对象去重时，同字的多个条目或合并后的多个序列不造成重码", () => {
    const input = [项("甲", [位(a)]), 项("甲", [位(a)]), 项("甲", [位(b)])];
    const before = 分析原始重码(配置, input, 2, [], true);
    expect([...before.values()]).toEqual([["甲"], ["甲"]]);
    const result = 分析边际重码(配置, input, 2, [[位(a), 位(b)]], true);
    expect([...result.合并分布.values()]).toEqual([["甲"]]);
    expect(result.新增对象).toEqual([]);
    expect(估计阶重码(result.合并分布, 0, 30)).toBe(0);
  });
});
