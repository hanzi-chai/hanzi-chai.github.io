import { isEqual, range } from "lodash-es";
import type { 动态组装条目, 组装条目 } from "./assembly.js";
import type { 分类器, 笔画名称 } from "./classifier.js";
import { 笔画表示方式 } from "./classifier.js";
import type { 部件 } from "./component.js";
import {
  type 元素位,
  type 兼容字形自定义,
  type 决策,
  type 决策空间,
  type 字形自定义,
  type 安排,
  type 安排描述,
  type 广义安排,
  type 广义码位,
  type 拼写运算,
  是变量,
  是归并,
  type 条件,
  type 生成配置,
  type 配置,
  type 非空安排,
} from "./config.js";
import {
  type 全等数据,
  type 原始汉字数据,
  type 向量,
  type 基本部件数据,
  type 复合体数据,
  type 字形描述,
  type 引用笔画数据,
  type 拼接部件数据,
  type 矢量笔画数据,
  type 结构描述字符,
  结构描述字符列表,
  type 绘制,
  type 衍生部件数据,
} from "./data.js";
import {
  二笔,
  type 元素,
  拼音元素,
  未知元素,
  笔画,
  结构符元素,
  type 自定义元素,
} from "./element.js";
import { 应用拼写运算, type 拼音分析映射 } from "./pinyin.js";
import type { 原始字库 } from "./primitive.js";
import type { 字库 } from "./repertoire.js";
import { 字符 } from "./unicode.js";

// Result 类型定义
export type Ok<T> = { ok: true; value: T; warning?: string };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;
export function ok<T>(value: T, warning?: string): Result<T, never> {
  return { ok: true, value, warning };
}
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
export function default_err(message: string): Result<never, Error> {
  return err(new Error(message));
}

// NTuple 类型定义
export type Tuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : _TupleOf<T, N, []>
  : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N
  ? R
  : _TupleOf<T, N, [T, ...R]>;

// 模拟函数
export const 模拟引用笔画 = (): 引用笔画数据 => ({
  feature: "reference",
  index: 0,
});

export const 模拟矢量笔画 = (
  名称: 笔画名称,
  起点: 向量 = [0, 0],
  旧绘制列表: 绘制[] = [],
): 矢量笔画数据 => {
  const 绘制类型列表 = 笔画表示方式[名称];
  return {
    feature: 名称,
    start: 起点,
    curveList: 绘制类型列表.map((command, index) => {
      if (旧绘制列表[index]?.command === command) {
        return 旧绘制列表[index]!;
      }
      switch (command) {
        case "a":
          return { command, parameterList: [20] };
        case "h":
        case "v":
          return { command, parameterList: [20] };
        default:
          return { command, parameterList: [10, 10, 20, 20, 30, 30] };
      }
    }),
  };
};

export const 模拟空基本部件 = (): 基本部件数据 => ({
  type: "basic_component",
  strokes: [],
});

export const 模拟基本部件 = (): 基本部件数据 => ({
  type: "basic_component",
  strokes: [模拟矢量笔画("横")],
});

export const 模拟衍生部件 = (): 衍生部件数据 => ({
  type: "derived_component",
  source: "一",
  strokes: [模拟引用笔画()],
});

export const 模拟拼接部件 = (): 拼接部件数据 => ({
  type: "spliced_component",
  operator: "⿰",
  operandList: ["一", "丨"],
});

export const 模拟全等 = (): 全等数据 => ({
  type: "identity",
  source: "一",
});

export const 模拟复合体 = (operator: 结构描述字符): 复合体数据 => ({
  type: "compound",
  operator,
  operandList: ["一", "一"],
});

export const 是基本或衍生部件 = (
  glyph: 字形描述,
): glyph is 基本部件数据 | 衍生部件数据 =>
  glyph.type === "basic_component" || glyph.type === "derived_component";

export const 创建原始汉字数据 = (
  unicode: number,
  glyphs: 字形描述[],
  name: string | null = null,
): 原始汉字数据 => ({
  unicode,
  tygf: 0,
  gb2312: 0,
  gf0014_id: null,
  gf3001_id: null,
  ambiguous: false,
  name,
  glyphs,
});

// 输入输出便利函数
interface 键位频率目标 {
  理想值: number;
  低于惩罚: number;
  高于惩罚: number;
}

export type 词典条目 = { 词: 字符[]; 拼音: string[]; 频率: number };
export type 原始词典条目 = Omit<词典条目, "词"> & { 词: string };
export type 词典 = 词典条目[];
export type 原始词典 = 原始词典条目[];
export type 频率映射 = Map<string, number>;
export type 键位分布目标 = Map<string, 键位频率目标>;
export type 当量映射 = Map<string, number>;

export const 可打印字符列表 = range(33, 127).map((x) =>
  String.fromCodePoint(x),
);

export function 读取表格(tsvText: string): string[][] {
  const lines = tsvText.trim().split("\n");
  const table: string[][] = lines.map((line) => line.split("\t"));
  return table;
}

export function 解析键位分布目标(tsv: string[][]): 键位分布目标 {
  const data: 键位分布目标 = new Map();
  for (const [char, ideal_s, lt_penalty_s, gt_penalty_s] of tsv) {
    if (
      char === undefined ||
      ideal_s === undefined ||
      lt_penalty_s === undefined ||
      gt_penalty_s === undefined
    )
      continue;
    const [ideal, lt_penalty, gt_penalty] = [
      ideal_s,
      lt_penalty_s,
      gt_penalty_s,
    ].map(Number) as [number, number, number];
    if (
      Number.isNaN(ideal) ||
      Number.isNaN(lt_penalty) ||
      Number.isNaN(gt_penalty)
    )
      continue;
    data.set(char, {
      理想值: ideal,
      低于惩罚: lt_penalty,
      高于惩罚: gt_penalty,
    });
  }
  return data;
}

export const 序列化键位频率目标 = (target: 键位分布目标): string[][] => {
  const result: string[][] = [];
  for (const [char, { 理想值, 低于惩罚, 高于惩罚 }] of target) {
    result.push([
      char,
      理想值.toString(),
      低于惩罚.toString(),
      高于惩罚.toString(),
    ]);
  }
  return result;
};

export function 解析当量映射(tsv: string[][]): 当量映射 {
  const data: 当量映射 = new Map();
  for (const [sequence, value_s] of tsv) {
    if (sequence === undefined || value_s === undefined) continue;
    const value = Number(value_s);
    if (Number.isNaN(value)) continue;
    data.set(sequence, value);
  }
  return data;
}

export const 序列化当量映射 = (mapping: 当量映射): string[][] => {
  const result: string[][] = [];
  for (const [char, value] of mapping) {
    result.push([char, value.toString()]);
  }
  return result;
};

export function 解析原始词典(tsv: string[][]): 原始词典 {
  const result: 原始词典条目[] = [];
  for (const [word, pinyin_s, frequency_s] of tsv) {
    if (
      word === undefined ||
      pinyin_s === undefined ||
      frequency_s === undefined
    )
      continue;
    const pinyin = pinyin_s.split(" ");
    const frequency = Number(frequency_s);
    if (Number.isNaN(frequency)) continue;
    result.push({ 词: word, 拼音: pinyin, 频率: frequency });
  }
  return result;
}

export function 序列化词典(词典: 原始词典): string[][] {
  const result: string[][] = [];
  for (const { 词, 拼音, 频率 } of 词典) {
    result.push([词, 拼音.join(" "), 频率.toString()]);
  }
  return result;
}

export function 解析笔画数据(tsv: string[][]) {
  const 笔画数据 = new Map<string, string>();
  for (const [char, strokes] of tsv) {
    if (char === undefined || strokes === undefined) continue;
    笔画数据.set(char, strokes);
  }
  return 笔画数据;
}

export function 解析自定义元素(tsv: string[][]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, values_s] of tsv) {
    if (key === undefined || values_s === undefined) continue;
    result[key] = values_s.split(" ");
  }
  return result;
}

export interface 码表条目 {
  词: string;
  编码: string;
}

export function 解析码表(tsv: string[][]): 码表条目[] {
  const result: 码表条目[] = [];
  for (const [word, code] of tsv) {
    if (word === undefined || code === undefined) continue;
    result.push({ 词: word, 编码: code });
  }
  return result;
}

export const 序列化 = (key?: 强类型元素位或编码) => {
  if (key === undefined) {
    return "ε";
  } else if (typeof key === "string") {
    return key;
  } else {
    return `${key.element.获取名称()}.${key.index}`;
  }
};

export const 总序列化 = (keys: (强类型元素位或编码 | undefined)[]) => {
  return keys.map(序列化).join(" ");
};

export const 反序列化 = (
  key: string,
  map: Map<string, 元素>,
): Result<强类型元素位或编码 | undefined, Error> => {
  if (key === "ε") {
    return ok(undefined);
  } else if (key.includes(".")) {
    const [element, index_s] = key.split(".");
    const index = Number(index_s);
    if (element === undefined || index_s === undefined || Number.isNaN(index)) {
      return default_err(`无法反序列化码位: ${key}`);
    }
    return ok({ element: map.get(element)!, index });
  } else {
    return ok(key);
  }
};

export const 计算拼音分析与元素映射 = (
  词典: 词典,
  拼写运算查找表: Map<string, 拼写运算>,
) => {
  const 音节集合 = new Set<string>();
  for (const { 拼音 } of 词典) {
    拼音.map((p) => 音节集合.add(p));
  }
  const 拼音元素映射: Map<string, 拼音元素[]> = new Map();
  const 拼音分析映射: 拼音分析映射 = new Map();
  for (const [类型, 拼写运算] of 拼写运算查找表) {
    const 元素名称映射 = new Map<string, 拼音元素>();
    for (const 音节 of 音节集合) {
      const 元素名称 = 应用拼写运算(拼写运算, 音节);
      const 元素 = 元素名称映射.get(元素名称) ?? new 拼音元素(类型, 元素名称);
      if (!元素名称映射.has(元素名称)) 元素名称映射.set(元素名称, 元素);
      const 拼音分析 = 拼音分析映射.get(音节) ?? new Map<string, 拼音元素>();
      拼音分析.set(类型, 元素);
      拼音分析映射.set(音节, 拼音分析);
    }
    const 元素列表 = [...元素名称映射.values()].sort((a, b) =>
      a.获取名称().localeCompare(b.获取名称()),
    );
    拼音元素映射.set(类型, 元素列表);
  }
  return { 拼音元素映射, 拼音分析映射 };
};

export const 计算全部合法元素与元素映射 = (
  字符列表: 字符[],
  分类器: 分类器,
  拼音元素映射: Map<string, 拼音元素[]>,
  自定义元素映射: Map<string, 自定义元素[]>,
) => {
  const 全部笔画类别 = [...new Set(Object.values(分类器))].sort(
    (a, b) => a - b,
  );
  const 笔画列表: 笔画[] = [];
  for (const n of 全部笔画类别) {
    笔画列表.push(笔画.创建(n));
  }
  const 二笔列表: 二笔[] = [];
  for (const n1 of 全部笔画类别) {
    for (const n2 of [0, ...全部笔画类别]) {
      二笔列表.push(二笔.创建(n1, n2));
    }
  }
  const 结构符元素列表 = 结构描述字符列表.map((x) => new 结构符元素(x));
  const 名称映射: Map<string, 元素> = new Map();
  const 普通元素: 元素[] = [
    ...字符列表,
    ...笔画列表,
    ...二笔列表,
    ...结构符元素列表,
  ];
  for (const 元素 of 普通元素) {
    名称映射.set(元素.获取名称(), 元素);
  }
  for (const [_, 元素列表] of 拼音元素映射) {
    for (const 元素 of 元素列表) 名称映射.set(元素.获取名称(), 元素);
  }
  for (const [_, 元素列表] of 自定义元素映射) {
    for (const 元素 of 元素列表) 名称映射.set(元素.获取名称(), 元素);
  }
  return {
    字符列表,
    笔画列表,
    二笔列表,
    结构符元素列表,
    拼音元素映射,
    自定义元素映射,
    名称映射,
  };
};

export const 合并字符串 = <T extends 强类型广义引用>(keys: T[]) => {
  return keys.every((x) => typeof x === "string") ? keys.join("") : keys;
};

export function 构建强类型决策与决策空间(
  决策: 决策,
  决策空间: 决策空间,
  元素名称映射: Map<string, 元素>,
) {
  const 强类型决策 = new Map<元素, 强类型非空安排>();
  const 强类型决策空间 = new Map<元素, 强类型安排描述[]>();
  const 当前元素名称映射 = new Map<string, 元素>(元素名称映射);
  for (const 元素名称 of Object.keys(决策).concat(Object.keys(决策空间))) {
    const 元素 = 元素名称映射.get(元素名称);
    if (!元素) {
      当前元素名称映射.set(元素名称, new 未知元素(元素名称));
    }
  }
  for (const [元素名称, 安排] of Object.entries(决策)) {
    const 元素 = 当前元素名称映射.get(元素名称)!;
    const 强安排 = 恢复安排(安排, 当前元素名称映射) as 强类型安排 | undefined;
    if (!强安排) continue;
    强类型决策.set(元素, 强安排);
  }
  for (const [元素名称, 安排描述列表] of Object.entries(决策空间)) {
    const 元素 = 当前元素名称映射.get(元素名称)!;
    const 强安排描述列表: 强类型安排描述[] = [];
    for (const { value, score, condition } of 安排描述列表) {
      const 强安排 = 恢复安排(value, 当前元素名称映射);
      if (强安排 === undefined) continue;
      if (condition) {
        const new_condition: 强类型条件[] = [];
        let valid = true;
        for (const { element, op, value } of condition) {
          const 依赖元素 = 当前元素名称映射.get(element);
          if (!依赖元素) {
            valid = false;
            break;
          }
          const 依赖安排 = 恢复安排(value, 当前元素名称映射) as
            | 强类型安排
            | undefined;
          if (依赖安排 === undefined) {
            valid = false;
            break;
          }
          new_condition.push({ element: 依赖元素, op, value: 依赖安排 });
        }
        if (valid) {
          强安排描述列表.push({
            value: 强安排,
            score,
            condition: new_condition,
          });
        }
      } else {
        强安排描述列表.push({ value: 强安排, score });
      }
    }
    强类型决策空间.set(元素, 强安排描述列表);
  }
  return { 决策: 强类型决策, 决策空间: 强类型决策空间 };
}

export function 构建强类型自定义分析(
  字库: 字库,
  原始字库: 原始字库,
  名称映射: Map<string, 元素>,
  自定义分析: Record<string, string[]>,
  动态自定义拆分: Record<string, string[][]>,
) {
  const 自定义分析映射: Map<部件, (字符 | 笔画 | 二笔)[]> = new Map();
  const 动态自定义分析映射: Map<部件, (字符 | 笔画 | 二笔)[][]> = new Map();
  for (const [key, value] of Object.entries(自定义分析)) {
    const 部件实例 = 字库.找到部件(key, 原始字库);
    if (!部件实例) continue;
    const 字根列表: (字符 | 笔画 | 二笔)[] = [];
    for (const 字根名称 of value) {
      const 字根 = 名称映射.get(字根名称);
      if (字根 instanceof 笔画 || 字根 instanceof 二笔 || 字根 instanceof 字符)
        字根列表.push(字根);
    }
    自定义分析映射.set(部件实例, 字根列表);
  }
  for (const [key, value] of Object.entries(动态自定义拆分)) {
    const 部件实例 = 字库.找到部件(key, 原始字库);
    if (!部件实例) continue;
    const 字根列表列表: (字符 | 笔画 | 二笔)[][] = [];
    for (const 字根名称列表 of value) {
      const 字根列表: (字符 | 笔画 | 二笔)[] = [];
      for (const 字根名称 of 字根名称列表) {
        const 字根 = 名称映射.get(字根名称);
        if (
          字根 instanceof 笔画 ||
          字根 instanceof 二笔 ||
          字根 instanceof 字符
        )
          字根列表.push(字根);
      }
      字根列表列表.push(字根列表);
    }
    动态自定义分析映射.set(部件实例, 字根列表列表);
  }
  return { 自定义分析映射, 动态自定义分析映射 };
}

export function 序列化安排(安排: 强类型广义安排): 广义安排 {
  if (安排 === null) return null;
  if (typeof 安排 === "string") return 安排;
  if (Array.isArray(安排)) {
    return 安排.map((x) => {
      if (typeof x === "string" || x === null) return x;
      if (是强类型变量(x)) return x;
      return { element: x.element.获取名称(), index: x.index };
    });
  }
  return { element: 安排.element.获取名称() };
}

export function 序列化强类型决策(决策: 强类型决策): 决策 {
  const 基本决策: 决策 = {};
  for (const [元素, 安排] of 决策) {
    基本决策[元素.获取名称()] = 序列化安排(安排) as 非空安排;
  }
  return 基本决策;
}

export function 序列化强类型决策空间(决策空间: 强类型决策空间): 决策空间 {
  const 基本决策空间: 决策空间 = {};
  for (const [元素, 安排描述列表] of 决策空间) {
    基本决策空间[元素.获取名称()] = 安排描述列表.map(
      ({ value, score, condition }) => {
        const 基本描述: 安排描述 = { value: 序列化安排(value), score };
        if (condition) {
          基本描述.condition = condition.map(({ element, op, value }) => ({
            element: element.获取名称(),
            op,
            value: 序列化安排(value) as 安排,
          }));
        }
        return 基本描述;
      },
    );
  }
  return 基本决策空间;
}

export class 决策图 {
  private readonly 安排表: Map<元素, 强类型非空安排>;
  private readonly 归并入边: Map<元素, 元素[]>;
  private readonly 第一位引用入边: Map<元素, 元素[]>;

  constructor(mapping: 强类型决策) {
    this.安排表 = new Map(mapping);
    this.归并入边 = new Map();
    this.第一位引用入边 = new Map();
    for (const [elem, 安排] of mapping) {
      if (是强类型归并(安排)) {
        const list = this.归并入边.get(安排.element) ?? [];
        list.push(elem);
        this.归并入边.set(安排.element, list);
      } else if (Array.isArray(安排)) {
        const 已添加 = new Set<元素>();
        // 只考虑第一位是引用的情况，因为其他位即使是引用也不影响第一码的分组和排序
        for (const part of 安排.slice(0, 1)) {
          if (typeof part === "string") continue;
          const ref = part.element;
          if (!已添加.has(ref)) {
            已添加.add(ref);
            const list = this.第一位引用入边.get(ref) ?? [];
            list.push(elem);
            this.第一位引用入边.set(ref, list);
          }
        }
      }
    }
  }

  线性化(): Result<Map<元素, string>, Error> {
    const cache = new Map<元素, string>();
    const visiting = new Set<元素>();

    const evaluate = (key: 元素): Result<string, Error> => {
      if (cache.has(key)) return ok(cache.get(key)!);
      if (visiting.has(key)) return default_err(`循环依赖: ${key.获取名称()}`);
      visiting.add(key);
      const 安排 = this.安排表.get(key);
      if (安排 === undefined)
        return default_err(`决策中不存在键: ${key.获取名称()}`);
      let result: Result<string, Error>;
      if (typeof 安排 === "string") {
        result = ok(安排);
      } else if (是强类型归并(安排)) {
        result = evaluate(安排.element);
      } else {
        const parts: string[] = [];
        for (const part of 安排) {
          if (typeof part === "string") {
            parts.push(part);
          } else if (part === null || 是强类型变量(part)) {
            parts.push("a");
          } else {
            const sub = evaluate(part.element);
            if (!sub.ok) return sub;
            parts.push(sub.value[part.index] ?? "");
          }
        }
        result = ok(parts.join(""));
      }
      visiting.delete(key);
      if (result.ok) cache.set(key, result.value);
      return result;
    };

    const output = new Map<元素, string>();
    for (const key of this.安排表.keys()) {
      const v = evaluate(key);
      if (!v.ok) return v;
      output.set(key, v.value);
    }
    return ok(output);
  }

  获取被归并元素(name: 元素): { from: 元素; to: 元素 }[] {
    const result: { from: 元素; to: 元素 }[] = [];
    const visit = (parent: 元素, node: 元素) => {
      result.push({ from: node, to: parent });
      for (const child of this.归并入边.get(node) ?? []) {
        visit(node, child);
      }
    };
    for (const child of this.归并入边.get(name) ?? []) {
      visit(name, child);
    }
    return result;
  }

  // 按第一码分组，组内按引用关系 DFS 排序（被引用者在前，引用者紧随其后）
  生成翻转决策(
    字母表: string,
  ): Result<Map<string, { 元素: 元素; 安排: 强类型非归并安排 }[]>, Error> {
    const 翻转决策 = new Map<
      string,
      { 元素: 元素; 安排: 强类型非归并安排 }[]
    >();
    for (const 字母 of [...字母表]) 翻转决策.set(字母, []);
    const 收集元素 = ({
      元素,
      安排,
    }: {
      元素: 元素;
      安排: string | 强类型元素位或编码[];
    }) => {
      const 结果 = [{ 元素, 安排 }];
      for (const 子元素 of this.第一位引用入边.get(元素) ?? []) {
        const 子安排 = this.安排表.get(子元素);
        if (typeof 子安排 === "string") {
          结果.push(...收集元素({ 元素: 子元素, 安排: 子安排 }));
        } else if (Array.isArray(子安排)) {
          结果.push(...收集元素({ 元素: 子元素, 安排: 子安排 }));
        }
      }
      return 结果;
    };
    for (const [元素, 安排] of this.安排表) {
      if (是强类型归并(安排)) continue;
      let 第一位字母: string | undefined;
      if (typeof 安排 === "string") {
        第一位字母 = 安排.slice(0, 1);
      } else if (Array.isArray(安排)) {
        const 第一位 = 安排[0];
        if (typeof 第一位 === "string") {
          第一位字母 = 第一位;
        }
      }
      if (第一位字母) {
        const group = 翻转决策.get(第一位字母);
        if (group) {
          group.push(...收集元素({ 元素, 安排 }));
        }
      }
    }
    return ok(翻转决策);
  }
}

export function 计算当前或潜在长度(
  决策: 强类型决策,
  决策空间: 强类型决策空间,
): Result<Map<元素, number>, Error> {
  const 增广决策: Map<元素, 强类型非空安排> = new Map(决策);
  for (const [key, 安排列表] of 决策空间) {
    if (!增广决策.has(key)) {
      const v = 安排列表.find((x) => x.value !== null);
      if (v === undefined)
        return default_err(`元素 ${key.获取名称()} 在决策空间中没有非空安排`);
      const value = v.value;
      if (value === null)
        return default_err(`元素 ${key.获取名称()} 在决策空间中没有非空安排`);
      if (是强类型归并(value)) 增广决策.set(key, value);
      else {
        增广决策.set(key, [...value].map((_) => "a").join(""));
      }
    }
  }
  const 线性化 = new 决策图(增广决策).线性化();
  if (!线性化.ok) return 线性化;
  return ok(new Map([...线性化.value].map(([k, v]) => [k, v.length])));
}

export type 强类型元素位或编码 = string | { element: 元素; index: number };

export const 下转换 = (c: 强类型元素位或编码) => {
  return typeof c === "string"
    ? c
    : { element: c.element.获取名称(), index: c.index };
};

export type 强类型广义引用 = 强类型元素位或编码 | null | { variable: string };

export type 强类型安排 = 强类型非空安排 | null;

export type 强类型非空安排 = string | 强类型元素位或编码[] | { element: 元素 };

export type 强类型广义安排 =
  | string
  | 强类型广义引用[]
  | { element: 元素 }
  | null;

export type 强类型非归并安排 = string | 强类型元素位或编码[];

export type 强类型决策 = Map<元素, 强类型非空安排>;

export type 强类型决策空间 = Map<元素, 强类型安排描述[]>;

export const 是强类型归并 = (a: 强类型广义安排): a is { element: 元素 } => {
  return typeof a === "object" && a !== null && "element" in a;
};

export const 是强类型变量 = (a: 强类型广义引用): a is { variable: string } => {
  return typeof a === "object" && a !== null && "variable" in a;
};

export function 恢复安排(
  安排: 广义安排,
  映射: Map<string, 元素>,
): 强类型广义安排 | undefined {
  if (安排 === null) return null;
  if (typeof 安排 === "string") return 安排;
  if (Array.isArray(安排)) {
    const ret: 强类型广义引用[] = [];
    for (const x of 安排) {
      if (typeof x === "string" || x === null) ret.push(x);
      else if (是变量(x)) ret.push(x);
      else {
        const 元素 = 映射.get(x.element);
        if (!元素) return undefined;
        ret.push({ element: 元素, index: x.index });
      }
    }
    return ret;
  }
  const 元素 = 映射.get(安排.element);
  if (!元素) return undefined;
  return { element: 元素 };
}

export interface 强类型安排描述 {
  value: 强类型广义安排;
  score: number;
  condition?: 强类型条件[];
}

export interface 强类型条件 {
  element: 元素;
  op: "是" | "不是";
  value: 强类型安排;
}

export const 识别符 = (词: 字符[], 拼音来源列表: string[][]) => {
  const 拼音列表 = 拼音来源列表.map((list) => list.join(" "));
  return `${词.map((c) => c.获取名称()).join("")}-${拼音列表.join(",")}`;
};

export type 自定义分析 = Record<string, string[]>;

export type 自定义分析映射 = Map<字符, Map<string, 自定义元素[]>>;

export const 排列组合 = <T>(array: T[][]): T[][] => {
  if (array.length === 0) return [[]];
  const [first, ...rest] = array;
  const restCombinations = 排列组合(rest);
  const combinations: T[][] = [];
  for (const item of first!) {
    for (const combination of restCombinations) {
      combinations.push([item, ...combination]);
    }
  }
  return combinations;
};

export const 添加优先简码 = <T extends 组装条目 | 动态组装条目>(
  entries: T[],
  优先简码映射: Map<string, number>,
) => {
  const result = entries.map((entry) => {
    const hash = 识别符(entry.词, entry.拼音来源列表);
    const level = 优先简码映射.get(hash);
    const { 拼音来源列表, ...rest } = entry;
    const value: Omit<T, "拼音来源列表"> & { 简码长度?: number } = rest;
    if (level !== undefined) value.简码长度 = level;
    return value;
  });
  return result;
};

export const 是源标签 = (tag: string): tag is 源标签 => /^[A-Z].*$/.test(tag);

export const 所有源标签 = [
  "G",
  "H",
  "T",
  "J",
  "K",
  "N",
  "V",
  "M",
  "S",
  "B",
  "U",
] as 源标签[];

export type 源标签 = string & { __brand: "source" };

export type 源标签集合 = Set<源标签>;

export const 标准化自定义 = (字形自定义: 兼容字形自定义) => {
  const 标准字形自定义: 字形自定义 = {};
  for (const [char, value] of Object.entries(字形自定义)) {
    if (Array.isArray(value)) {
      标准字形自定义[char] = value;
    } else {
      标准字形自定义[char] = [value];
    }
  }
  return 标准字形自定义;
};

export const 生成 = (config: 配置): 生成配置 => {
  const mapping = config.form.mapping;
  const mapping_space = config.form.mapping_space ?? {};
  const variables = config.form.mapping_variables ?? {};
  const generators = config.form.mapping_generators ?? [];

  const space: 决策空间 = structuredClone(mapping_space);

  // Step 1: 合并初始决策
  // Every element in mapping must have an entry in space
  for (const name of Object.keys(mapping)) {
    if (!(name in space)) space[name] = [];
  }
  // Each element's current mapping value must appear in its space list
  for (const [name, arrangements] of Object.entries(space)) {
    const current: 广义安排 = mapping[name] ?? null;
    if (!arrangements.some((a) => isEqual(a.value, current))) {
      arrangements.unshift({ value: current, score: 0.0 });
    }
  }

  // Step 2: 应用生成器
  for (const { regex, value } of generators) {
    const 模式 = new RegExp(regex);
    for (const [元素名称, 安排列表] of Object.entries(space)) {
      if (!模式.test(元素名称)) continue;
      const 安排描述 = structuredClone(value);
      const 生成器安排 = 安排描述.value;
      if (Array.isArray(生成器安排)) {
        // For each existing Basic/Advanced arrangement, synthesize a new one using the template
        const 合成安排列表: 广义码位[][] = [];
        for (const 安排 of 安排列表) {
          const ev = 安排.value;
          if (typeof ev !== "string" && !Array.isArray(ev)) continue;
          const 约化安排: 广义码位[] = typeof ev === "string" ? [...ev] : ev;
          let valid = true;
          const combined: 广义码位[] = [];
          for (const [i, tpl] of 生成器安排.entries()) {
            const cur = 约化安排[i];
            if (cur === undefined) {
              valid = false;
              break;
            }
            // Variable placeholders may only substitute ASCII (string) keys
            if (typeof cur !== "string" && 是变量(tpl)) {
              valid = false;
              break;
            }
            // null in template means placeholder: keep existing value
            combined.push(tpl === null ? cur : tpl);
          }
          if (!valid) continue;
          if (!合成安排列表.some((v) => isEqual(v, combined)))
            合成安排列表.push(combined);
        }
        for (const value of 合成安排列表) {
          安排列表.push({ ...安排描述, value });
        }
      } else {
        安排列表.push(安排描述);
      }
    }
  }

  // Step 3: 展开变量 — replace Variable placeholders with all possible concrete values
  for (const 安排列表 of Object.values(space)) {
    const 队列 = [...安排列表];
    安排列表.length = 0;
    while (队列.length > 0) {
      const item = 队列.shift()!;
      const value = item.value;
      let expanded = false;
      if (Array.isArray(value)) {
        for (const [i, key] of value.entries()) {
          if (是变量(key)) {
            for (const varValue of variables[key.variable]?.keys ?? []) {
              const newKeys = [...value];
              newKeys[i] = varValue;
              队列.push({ ...item, value: newKeys });
            }
            expanded = true;
            break;
          }
        }
      }
      if (!expanded) 安排列表.push(item);
    }
  }

  // Step 4: 补充存在性条件 — arrangements referencing other elements require those elements to be non-null
  for (const 安排列表 of Object.values(space)) {
    for (const 安排 of 安排列表) {
      const referenced = new Set<string>();
      const value = 安排.value;
      if (是归并(value)) {
        referenced.add(value.element);
      } else if (Array.isArray(value)) {
        for (const key of value) {
          if (
            typeof key === "object" &&
            key !== null &&
            "element" in key &&
            "index" in key
          )
            referenced.add((key as 元素位).element);
        }
      }
      if (referenced.size === 0) continue;
      const newConditions: 条件[] = [...referenced].map((element) => ({
        element,
        op: "不是" as const,
        value: null,
      }));
      if (安排.condition) 安排.condition.push(...newConditions);
      else 安排.condition = newConditions;
    }
  }

  return { ...config, generated_mapping_space: space };
};
