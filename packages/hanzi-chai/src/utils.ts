import { range } from "lodash-es";
import type { 笔画名称 } from "./classifier.js";
import { 笔画表示方式 } from "./classifier.js";
import type {
  元素,
  决策,
  决策空间,
  广义码位,
  码位,
  非空广义安排,
} from "./config.js";
import type {
  全等数据,
  原始汉字数据,
  向量,
  基本部件数据,
  复合体数据,
  字形数据,
  引用笔画数据,
  拼接部件数据,
  矢量笔画数据,
  结构表示符,
  绘制,
  衍生部件数据,
} from "./data.js";
import type {
  兼容字形自定义,
  动态组装条目,
  字形自定义,
  组装条目,
} from "./main.js";

// Result 类型定义
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
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

export const 模拟复合体 = (operator: 结构表示符): 复合体数据 => ({
  type: "compound",
  operator,
  operandList: ["一", "一"],
});

export const 是部件或全等 = (
  glyph: 字形数据,
): glyph is 基本部件数据 | 衍生部件数据 | 拼接部件数据 | 全等数据 =>
  glyph.type === "basic_component" ||
  glyph.type === "derived_component" ||
  glyph.type === "spliced_component" ||
  glyph.type === "identity";

export const 是基本或衍生部件 = (
  glyph: 字形数据,
): glyph is 基本部件数据 | 衍生部件数据 =>
  glyph.type === "basic_component" || glyph.type === "derived_component";

export const 是拼接部件或复合体 = (
  glyph: 字形数据,
): glyph is 拼接部件数据 | 复合体数据 =>
  glyph.type === "spliced_component" || glyph.type === "compound";

export const 创建原始汉字数据 = (
  unicode: number,
  glyphs: 字形数据[],
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

export type 词典条目 = { 词: string; 拼音: string[]; 频率: number };
export type 词典 = 词典条目[];
export type 频率映射 = Map<string, number>;
export type 键位分布目标 = Map<string, 键位频率目标>;
export type 当量映射 = Map<string, number>;

export const 可打印字符列表 = range(33, 127).map((x) =>
  String.fromCodePoint(x),
);

export const 字数 = (s: string) => {
  return Array.from(s).length;
};

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

export function 解析词典(tsv: string[][]): 词典 {
  const result: 词典 = [];
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

export function 序列化词典(词典: 词典): string[][] {
  const result: string[][] = [];
  for (const { 词, 拼音, 频率 } of 词典) {
    result.push([词, 拼音.join(" "), 频率.toString()]);
  }
  return result;
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

export const 序列化 = (key?: 码位) => {
  if (key === undefined) {
    return "ε";
  } else if (typeof key === "string") {
    return key;
  } else {
    return `${key.element}.${key.index}`;
  }
};

export const 总序列化 = (keys: (码位 | undefined)[]) => {
  return keys.map(序列化).join(" ");
};

export const 反序列化 = (key: string): Result<码位 | undefined, Error> => {
  if (key === "ε") {
    return ok(undefined);
  } else if (key.includes(".")) {
    const [element, index_s] = key.split(".");
    const index = Number(index_s);
    if (element === undefined || index_s === undefined || Number.isNaN(index)) {
      return default_err(`无法反序列化码位: ${key}`);
    }
    return ok({ element: element, index });
  } else {
    return ok(key);
  }
};

export const 合并字符串 = <T extends 广义码位>(keys: T[]) => {
  return keys.every((x) => typeof x === "string") ? keys.join("") : keys;
};

const 展开决策值 = (
  mapping: Record<元素, 非空广义安排>,
  key: string,
): Result<string, Error> => {
  const value = mapping[key];
  if (value === undefined) {
    return default_err(`决策中不存在键: ${key}`);
  }
  if (typeof value === "string") {
    return ok(value);
  } else if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const part of value) {
      if (typeof part === "string") {
        parts.push(part);
      } else if (
        part === null ||
        (typeof part === "object" && "variable" in part)
      ) {
        parts.push("a");
      } else {
        const 部分值 = 展开决策值(mapping, part.element);
        if (!部分值.ok) return 部分值;
        parts.push(部分值.value);
      }
    }
    return ok(parts.join(""));
  } else {
    return 展开决策值(mapping, value.element);
  }
};

export const 展开决策 = (mapping: 决策): Result<Map<string, string>, Error> => {
  const result = new Map<string, string>();
  for (const key of Object.keys(mapping)) {
    const value = 展开决策值(mapping, key);
    if (!value.ok) return value;
    result.set(key, value.value);
  }
  return ok(result);
};

export const 计算当前或潜在长度 = (
  mapping: 决策,
  mapping_space: 决策空间,
): Result<Map<string, number>, Error> => {
  const result = new Map<string, number>();
  for (const key of Object.keys(mapping)) {
    const value = 展开决策值(mapping, key);
    if (!value.ok) return value;
    result.set(key, value.value.length);
  }
  const 增广决策: Record<string, 非空广义安排> = { ...mapping };
  for (const [key, value] of Object.entries(mapping_space)) {
    if (!(key in 增广决策)) {
      const v = value.find((x) => x.value !== null);
      if (v !== undefined) {
        增广决策[key] = v.value as 非空广义安排;
      }
    }
  }
  for (const key of Object.keys(增广决策)) {
    if (!result.has(key)) {
      const value = 展开决策值(增广决策, key);
      if (!value.ok) return value;
      result.set(key, value.value.length);
    }
  }
  return ok(result);
};

export const 识别符 = (词: string, 拼音来源列表: string[][]) => {
  const 拼音列表 = 拼音来源列表.map((list) => list.join(" "));
  return `${词}-${拼音列表.join(",")}`;
};

export type 自定义分析 = Record<string, string[]>;

export type 自定义分析映射 = Map<string, 自定义分析>;

export function 获取汉字集合(词典: 词典): Set<string> {
  const 汉字集合 = new Set<string>();
  for (const { 词 } of 词典) {
    for (const 汉字 of Array.from(词)) {
      汉字集合.add(汉字);
    }
  }
  return 汉字集合;
}

export const 码 = (汉字: string) =>
  汉字.codePointAt(0)!.toString(16).toUpperCase();

export const 和编码 = (c: string) => `${c} (U+${码(c)})`;

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

export const 是地区标签 = (tag: string) => /^[GHTJKNVMSBU]$/.test(tag);

export const 获取地区标签列表 = (glyph: 字形数据) =>
  (glyph.tags ?? []).filter(是地区标签);

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
