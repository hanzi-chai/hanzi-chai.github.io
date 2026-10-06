/**
 * 阶重统计——唯一权威实现（2026-09-29 起全项目统一）。
 * 来源：原样抽取自 src/pages/[id]/statistics.tsx 的 各阶重分析（OrderDuplicationAnalyzer），
 * 网页各阶重分析、加根分析、CLI 评分器、增量评分器、智能选根 全部改用本模块，禁止在别处重写公式。
 *
 * 口径（网页原版，2026-09-29 恢复并全站统一）：
 *  - 一阶及以上：n²/2 ÷ 26^阶 —— 独立随机编码期望（含单字组自身对；n²/2 = n(n−1)/2 + n/2，
 *    自身对部分 Σn/2/26^k 是与方案无关的常数，不影响方案间比较）
 *  - 零阶：精确计数 Σ(n−1)
 *  - 分组身份：下转换(码位) = { element: 元素名, index }；不足 maxLength 的序列以 "ε" 补位
 *  - 频率排序后按 top 截断（0 = 全部）
 */
import { isEqual, range } from "lodash-es";
import { 下转换 } from "../../packages/hanzi-chai/src/main";
import type { 组装条目, 强类型元素位或编码 } from "../../packages/hanzi-chai/src/main";

export interface 阶重分析配置 {
  type: "single" | "multi" | "all";
  position: number[];
  top: number;
}

export function 阶重filterRelevant(result: 组装条目[], 分析配置: 阶重分析配置) {
  let relevant = result.sort((a, b) => b.频率 - a.频率);
  if (分析配置.type === "single")
    relevant = relevant.filter((x) => [...x.词].length === 1);
  if (分析配置.type === "multi")
    relevant = relevant.filter((x) => [...x.词].length > 1);
  if (分析配置.top > 0) {
    relevant = relevant.slice(0, 分析配置.top);
  }
  return relevant;
}

export function 阶重分析原始重码(
  分析配置: 阶重分析配置,
  result: 组装条目[],
  maxLength: number,
  合并组列表: 强类型元素位或编码[][] = [],
) {
  const 反向映射 = new Map<string, string[]>();
  const 相关结果 = 阶重filterRelevant(result, 分析配置);
  for (const 条目 of 相关结果) {
    const { 词, 元素序列 } = 条目;
    const 处理后元素序列: (强类型元素位或编码 | undefined)[] = [];
    for (const i of range(maxLength)) {
      if (分析配置.position.includes(i)) {
        const 码位 = 元素序列.元素序列[i];
        const index = 合并组列表.findIndex((group) =>
          group.some((y) => isEqual(y, 码位)),
        );
        处理后元素序列.push(
          index !== -1 ? String.fromCodePoint(0x100000 + index) : 码位,
        );
      } else {
        处理后元素序列.push("*");
      }
    }
    const summary = JSON.stringify(
      处理后元素序列.map((x) => (x !== undefined ? 下转换(x) : "ε")),
    );
    反向映射.set(
      summary,
      (反向映射.get(summary) || []).concat(
        词.map((c) => c.获取名称()).join(""),
      ),
    );
  }
  return 反向映射;
}

/** 阶重合计的唯一公式实现：零阶精确 Σ(n−1)，一阶以上 n²/2÷按键数^阶（网页原版公式，底数=键盘字母表大小）。
 *  输入为分组计数（增量评分/核心的高性能路径）。 */
export function 阶重估计计数(
  计数: Map<string, number>,
  空位: number[],
  alphabetSize: number,
): number {
  if (空位.length === 0) {
    let total = 0;
    计数.forEach((n) => {
      if (n > 1) total += n - 1;
    });
    return total;
  }
  const space = alphabetSize ** 空位.length;
  let total = 0;
  计数.forEach((n) => {
    total += (n * n) / 2 / space;
  });
  return total;
}

/** 单模式估计（词列表版）：零阶精确 Σ(n−1)，一阶以上 n²/2÷按键数^阶（网页原版公式） */
export function 阶重估计(
  reverseMap: Map<string, string[]>,
  空位: number[],
  alphabetSize: number,
): number {
  const 计数 = new Map<string, number>();
  reverseMap.forEach((items, k) => 计数.set(k, items.length));
  return 阶重估计计数(计数, 空位, alphabetSize);
}

/** 增量评分用：给定（已归并展开的）码位序列与空位模式，产出与网页完全一致的分组键
 *  序列元素 = { element: 元素名, index }（与 下转换 的返回同形）或字符串（固定码位） */
export function 阶重序列键(
  序列: ({ element: string; index: number } | string | [string, number])[],
  空位: number[],
  maxLength: number,
): string {
  const 处理后 = range(maxLength).map((i) => {
    if (空位.includes(i)) return "*";
    const 码位 = 序列[i];
    if (码位 === undefined) return "ε";
    if (typeof 码位 === "string") return 码位;
    if (Array.isArray(码位)) return { element: 码位[0], index: 码位[1] };
    return { element: 码位.element, index: 码位.index };
  });
  return JSON.stringify(处理后);
}

/** 增量评分用：n²/2 口径的分组计数增量（k=0 走精确 Σ(n−1)）；按键数=键盘字母表大小（随方案而定，不写死 26） */
export function 阶重加增量(k: number, m: number, 按键数: number): number {
  if (k === 0) return m >= 1 ? 1 : 0;
  return (m + 0.5) / 按键数 ** k;
}
export function 阶重减增量(k: number, n: number, 按键数: number): number {
  if (k === 0) return n >= 2 ? -1 : 0;
  return -(n - 0.5) / 按键数 ** k;
}
