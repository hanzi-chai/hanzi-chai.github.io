import type { 字集指示 } from "./config.js";
import { type 字库, 是部件 } from "./repertoire.js";
import { type 字符, 字集过滤查找表 } from "./unicode.js";
import { 解析码表, type 码表条目 } from "./utils.js";

export const 码表格式列表 = [
  "char_tab_code",
  "char_space_code",
  "code_tab_char",
  "code_space_char",
] as const;
export type 码表格式 = (typeof 码表格式列表)[number];

export function 按格式解析码表(内容: string, 格式: 码表格式): 码表条目[] {
  const 分隔符 = 格式.includes("tab") ? "\t" : /\s+/;
  const 字在前 = 格式.startsWith("char");
  const 表格 = 内容
    .trim()
    .split(/\r?\n/)
    .map((行) => {
      const 列 = 行.split(分隔符);
      return 字在前 ? 列 : 列.slice(0, 2).reverse();
    });
  return 解析码表(表格);
}

export type 校对范围 = 字集指示 | "components";
export type 校对方向 = "forward" | "reverse";
export type 校对状态 = "correct" | "incorrect" | "unknown";

interface 系统码表条目<T> extends 码表条目 {
  元素序列: readonly T[];
}

export interface 校对条目<T> extends 系统码表条目<T> {
  参考编码列表: string[];
  状态: 校对状态;
}

interface 校对选项 {
  字库: 字库;
  汉字集合: ReadonlySet<字符>;
  范围: 校对范围;
  方向: 校对方向;
}

export function 校对码表<T>(
  系统码表: Iterable<系统码表条目<T>>,
  外部码表: readonly 码表条目[],
  { 字库, 汉字集合, 范围, 方向 }: 校对选项,
) {
  const 统计: Record<校对状态, number> = {
    correct: 0,
    incorrect: 0,
    unknown: 0,
  };
  const 条目: 校对条目<T>[] = [];
  const 记录 = (
    词: string,
    编码: string,
    参考编码列表: string[],
    元素序列: readonly T[],
  ) => {
    const 数据 = 字库.校验字符(词);
    if (!数据) return;
    const 字 = 数据.character;
    const 符合范围 =
      范围 === "components"
        ? 汉字集合.has(字) && 字库.查询字符的字形(字)?.some(是部件)
        : 字集过滤查找表[范围](字, 数据);
    if (!符合范围) return;

    let 状态: 校对状态 = "unknown";
    if (参考编码列表.length > 0) {
      状态 = 参考编码列表.includes(编码) ? "correct" : "incorrect";
    }
    统计[状态]++;
    条目.push({ 词, 编码, 参考编码列表, 元素序列, 状态 });
  };
  if (方向 === "forward") {
    const 外部编码映射 = new Map<string, string[]>();
    for (const { 词, 编码 } of 外部码表) {
      const 列表 = 外部编码映射.get(词);
      if (列表) 列表.push(编码);
      else 外部编码映射.set(词, [编码]);
    }
    for (const { 词, 编码, 元素序列 } of 系统码表) {
      记录(词, 编码, 外部编码映射.get(词) ?? [], 元素序列);
    }
  } else {
    const 系统编码映射 = new Map<string, 系统码表条目<T>[]>();
    for (const 条目 of 系统码表) {
      const 列表 = 系统编码映射.get(条目.词);
      if (列表) 列表.push(条目);
      else 系统编码映射.set(条目.词, [条目]);
    }
    for (const { 词, 编码 } of 外部码表) {
      const 参考条目 = 系统编码映射.get(词) ?? [];
      记录(
        词,
        编码,
        参考条目.map((x) => x.编码),
        参考条目.flatMap((x) => x.元素序列),
      );
    }
  }
  const 已知 = 统计.correct + 统计.incorrect;
  return { 条目, 统计, 准确率: 已知 === 0 ? null : 统计.correct / 已知 };
}
