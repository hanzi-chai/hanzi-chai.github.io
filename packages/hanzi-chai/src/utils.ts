import type { 笔画名称 } from "./classifier.js";
import { 笔画表示方式 } from "./classifier.js";
import type {
  衍生部件数据,
  复合体数据,
  绘制,
  结构表示符,
  向量,
  矢量笔画数据,
  基本部件数据,
  引用笔画数据,
  拼接部件数据,
  字形数据,
  全等数据,
  原始汉字数据,
} from "./data.js";
import { range } from "lodash-es";
import type { 码位, 决策, 广义码位 } from "./config.js";

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
  ideal: number;
  lt_penalty: number;
  gt_penalty: number;
}

export type 词典条目 = { 词: string; 拼音: string[]; 频率: number };
export type 词典 = 词典条目[];
export type 频率映射 = Map<string, number>;
export type 键位分布目标 = Map<string, 键位频率目标>;
export type 当量映射 = Map<string, number>;
export type 自定义元素映射 = Map<string, string[]>;

export const 可打印字符列表 = range(33, 127).map((x) =>
  String.fromCodePoint(x),
);

export const chars = (s: string) => {
  return Array.from(s).length;
};

export const listToObject = <T extends { unicode: number }>(list: T[]) =>
  Object.fromEntries(list.map((x) => [String.fromCodePoint(x.unicode), x]));

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
    data.set(char, { ideal, lt_penalty, gt_penalty });
  }
  return data;
}

export function 解析当量(tsv: string[][]): 当量映射 {
  const data: 当量映射 = new Map();
  for (const [char, value_s] of tsv) {
    if (char === undefined || value_s === undefined) continue;
    const value = Number(value_s);
    if (Number.isNaN(value)) continue;
    data.set(char, value);
  }
  return data;
}

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

export const 序列化 = (key?: 码位) => {
  if (key === undefined) {
    return "ε";
  } else if (typeof key === "string") {
    return key;
  } else {
    return `${key.element}.${key.index}`;
  }
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

const 展开决策值 = (mapping: 决策, key: string): Result<string, Error> => {
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

export const 识别符 = (词: string, 拼音来源列表: string[][]) => {
  const 拼音列表 = 拼音来源列表.map((list) => list.join(" "));
  return `${词}-${拼音列表.join(",")}`;
};
