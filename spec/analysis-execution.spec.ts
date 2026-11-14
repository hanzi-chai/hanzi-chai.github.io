import { describe, expect, it } from "bun:test";
import {
  type 分析执行环境,
  创建静态分析环境,
  推导动态分析,
  选择分析,
} from "../src/analysis-execution.js";
import type { 条件 } from "../src/config.js";
import { default_err, ok, type Result, 优先表 } from "../src/utils.js";

const A: 条件 = { element: "甲", op: "不是", value: null };
const B: 条件 = { element: "乙", op: "不是", value: null };
const 非A: 条件 = { ...A, op: "是" };
const 解包 = <T>(结果: Result<T, Error>): T => {
  if (!结果.ok) throw 结果.error;
  return 结果.value;
};

describe("从共享分析规则推导动态分析", () => {
  it("候选准备跨分支只执行一次，缓存按配置隔离且不跨推导调用", () => {
    const 配置甲 = {},
      配置乙 = {},
      输入 = {};
    let 计算次数 = 0;
    const 计算 = () => ++计算次数;
    const 规则 = (环境: 分析执行环境) => {
      const 甲 = 环境.缓存(配置甲, 输入, 计算);
      const 乙 = 环境.缓存(配置乙, 输入, 计算);
      return ok({ 甲, 乙, 选中: 环境.判断(A) });
    };
    const 候选 = [...解包(推导动态分析(规则))];
    expect(计算次数).toBe(2);
    expect(候选.map(({ 甲, 乙 }) => [甲, 乙])).toEqual([
      [1, 2],
      [1, 2],
    ]);
    解包(推导动态分析(规则));
    expect(计算次数).toBe(4);
  });

  it("必需的子分析缺失时仅排除该路径，仍保留后续分支的条件", () => {
    const 候选 = 解包(
      推导动态分析((环境) => {
        if (环境.判断(A)) {
          选择分析([{ 条件列表: [B] }], 环境);
          return ok({ 值: "双根" });
        }
        return ok({ 值: "无甲" });
      }),
    );
    expect([...候选]).toEqual([
      { 值: "双根", 条件列表: [A, B] },
      { 值: "无甲", 条件列表: [非A] },
    ]);
  });

  it("仅探索遇到的条件，并将完整路径转换成有序回退", () => {
    const 规则 = (环境: 分析执行环境) => {
      if (环境.判断(A)) return ok({ 结果: "甲" });
      if (环境.判断(B)) return ok({ 结果: "乙" });
      return ok({ 结果: "回退" });
    };
    const 候选 = [...解包(推导动态分析(规则))];
    expect(候选).toEqual([
      { 结果: "甲", 条件列表: [A] },
      { 结果: "乙", 条件列表: [B] },
      { 结果: "回退", 条件列表: [] },
    ]);
    for (let mask = 0; mask < 4; mask++) {
      const 环境 = 创建静态分析环境((条件) => {
        const 存在 = !!(mask & (条件.element === "甲" ? 1 : 2));
        return 条件.op === "不是" ? 存在 : !存在;
      });
      expect(环境.选择(候选)?.结果).toBe(解包(规则(环境)).结果);
    }
  });

  it("重复和取反查询共享决定，多个候选表不会产生互相矛盾的组合", () => {
    const 表 = new 优先表([
      { 值: 1, 条件列表: [A] },
      { 值: 2, 条件列表: [] },
    ]);
    const 候选 = 解包(
      推导动态分析((环境) => {
        const 左 = 环境.选择(表)!;
        const 右 = 环境.选择(表)!;
        expect(环境.判断(非A)).toBe(!环境.判断({ ...A }));
        return ok({ 左: 左.值, 右: 右.值 });
      }),
    );
    expect([...候选]).toEqual([
      { 左: 1, 右: 1, 条件列表: [A] },
      { 左: 2, 右: 2, 条件列表: [] },
    ]);
  });

  it("按候选顺序选择，支持合取条件和无条件回退", () => {
    const 表 = new 优先表([
      { 值: "双根", 条件列表: [A, B] },
      { 值: "乙", 条件列表: [B] },
      { 值: "回退", 条件列表: [] },
    ]);
    const 动态 = 解包(推导动态分析((环境) => ok({ 值: 环境.选择(表)!.值 })));
    for (let mask = 0; mask < 4; mask++) {
      const 环境 = 创建静态分析环境((条件) => {
        const 存在 = !!(mask & (条件.element === "甲" ? 1 : 2));
        return 条件.op === "不是" ? 存在 : !存在;
      });
      expect(环境.选择(动态)?.值).toBe(环境.选择(表)?.值);
    }
  });

  it("支持结构化条件值，且不会按对象引用重复分支", () => {
    const 条件: 条件 = { element: "甲", op: "是", value: { element: "乙" } };
    const 候选 = 解包(
      推导动态分析((环境) => {
        const 首次 = 环境.判断(条件);
        return ok({ 首次, 再次: 环境.判断(structuredClone(条件)) });
      }),
    );
    expect([...候选].map(({ 首次, 再次 }) => [首次, 再次])).toEqual([
      [true, true],
      [false, false],
    ]);
  });

  it("规则可明确返回空结果，不会生成伪造候选", () => {
    const 候选 = 解包(
      推导动态分析((环境) => {
        const 项 = 环境.选择([{ 值: 1, 条件列表: [A] }]);
        return ok(项 === undefined ? undefined : { 值: 项.值 });
      }),
    );
    expect([...候选]).toEqual([{ 值: 1, 条件列表: [A] }]);
    expect([
      ...解包(
        推导动态分析((环境) => {
          return ok(环境.选择([]));
        }),
      ),
    ]).toEqual([]);
  });

  it("保留分析错误和意外异常，不将失败静默当作空候选", () => {
    const 失败 = default_err("缺少部件");
    expect(推导动态分析((环境) => (环境.判断(A) ? ok({}) : 失败))).toBe(失败);
    const 异常 = new Error("意外异常");
    expect(() =>
      推导动态分析(() => {
        throw 异常;
      }),
    ).toThrow(异常);
  });

  it("共享规则可以处理选择无匹配项时的回退", () => {
    const 候选 = 解包(
      推导动态分析((环境) => {
        const 项 = 环境.选择([{ 值: 1, 条件列表: [A] }]);
        return ok({ 值: 项?.值 ?? 2 });
      }),
    );
    expect([...候选]).toEqual([
      { 值: 1, 条件列表: [A] },
      { 值: 2, 条件列表: [] },
    ]);
  });

  it("成立分支有缺口时保留否定条件，不能错误放宽回退的适用范围", () => {
    const 候选 = 解包(
      推导动态分析((环境) => {
        if (环境.判断(A)) {
          if (!环境.选择([{ 条件列表: [B] }])) return ok(undefined);
          return ok({ 值: "双根" });
        }
        return ok({ 值: "无甲" });
      }),
    );
    expect([...候选]).toEqual([
      { 值: "双根", 条件列表: [A, B] },
      { 值: "无甲", 条件列表: [非A] },
    ]);
    const 环境 = 创建静态分析环境((条件) =>
      条件.op === "不是" ? 条件.element === "甲" : 条件.element !== "甲",
    );
    expect(环境.选择(候选)).toBeUndefined();
  });
});
