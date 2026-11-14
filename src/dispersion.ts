import type { 组装条目 } from "./assembly.js";
import {
  下转换,
  type 强类型元素位或编码,
  type 强类型决策,
  是强类型归并,
} from "./utils.js";

export interface 离散分析配置 {
  type: "single" | "multi" | "all";
  /** 保留的码位，索引从零开始；其他码位视为通配符。 */
  position: readonly number[];
  /** 按条目频率取前 N 项；0 表示全部。 */
  top: number;
}

export function 筛选组装结果(条目: readonly 组装条目[], 配置: 离散分析配置) {
  const 结果 = 条目
    .filter(
      ({ 词 }) =>
        配置.type === "all" ||
        (配置.type === "single" ? 词.length === 1 : 词.length > 1),
    )
    .sort((a, b) => b.频率 - a.频率);
  return 配置.top > 0 ? 结果.slice(0, 配置.top) : 结果;
}

/** 只解析显式归并与元素位引用；直接安排到同一键的元素仍彼此不同。 */
export function 归并组装结果(
  条目: readonly 组装条目[],
  决策: 强类型决策,
): 组装条目[] {
  const 解析 = (码位: 强类型元素位或编码): 强类型元素位或编码 => {
    const 已访问 = new Set<string>();
    while (typeof 码位 !== "string") {
      const 名称 = JSON.stringify(下转换(码位));
      if (已访问.has(名称)) throw new Error(`元素位归并循环：${名称}`);
      已访问.add(名称);
      const 安排 = 决策.get(码位.element);
      if (安排 && 是强类型归并(安排)) {
        码位 = { ...码位, element: 安排.element };
      } else if (Array.isArray(安排)) {
        const 引用 = 安排[码位.index];
        if (引用 === undefined || typeof 引用 === "string") break;
        码位 = 引用;
      } else break;
    }
    return 码位;
  };
  return 条目.map((项) => ({
    ...项,
    元素序列: { ...项.元素序列, 元素序列: 项.元素序列.元素序列.map(解析) },
  }));
}

/**
 * 与前端多元分布共用：全码位相同是零阶组；省略一个码位得到一阶投影组。
 * 短序列补 ε，未选码位填 *。返回每个投影组的对象列表，保留条目级统计口径。
 */
export function 分析元素分组(
  配置: 离散分析配置,
  条目: readonly 组装条目[],
  最大码长: number,
  合并组列表: readonly (readonly 强类型元素位或编码[])[] = [],
): Map<string, 组装条目[]> {
  const 合并索引 = new Map<string, string>();
  合并组列表.forEach((组, i) => {
    for (const 位 of 组) {
      const key = JSON.stringify(下转换(位));
      if (!合并索引.has(key))
        合并索引.set(key, String.fromCodePoint(0x100000 + i));
    }
  });
  const 结果 = new Map<string, 组装条目[]>();
  for (const 项 of 筛选组装结果(条目, 配置)) {
    const { 元素序列 } = 项;
    const 序列 = Array.from({ length: 最大码长 }, (_, i) => {
      if (!配置.position.includes(i)) return "*";
      const 位 = 元素序列.元素序列[i];
      if (位 === undefined) return "ε";
      return 合并索引.get(JSON.stringify(下转换(位))) ?? 下转换(位);
    });
    const key = JSON.stringify(序列);
    const 组 = 结果.get(key) ?? [];
    组.push(项);
    结果.set(key, 组);
  }
  return 结果;
}

/** 对象名称分布；可按对象去重，避免同字多音条目被算作异字重码。 */
export function 分析原始重码(
  配置: 离散分析配置,
  条目: readonly 组装条目[],
  最大码长: number,
  合并组列表: readonly (readonly 强类型元素位或编码[])[] = [],
  按对象去重 = false,
): Map<string, string[]> {
  return new Map(
    [...分析元素分组(配置, 条目, 最大码长, 合并组列表)].map(([key, 组]) => {
      const 对象 = 组.map(({ 词 }) => 词.map((c) => c.获取名称()).join(""));
      return [key, 按对象去重 ? [...new Set(对象)] : 对象];
    }),
  );
}

/** 零阶是非首项数；高阶保留前端 n² / (2 × 键数^阶数) 的均匀分配估计。 */
export function 估计阶重码(
  分布: ReadonlyMap<string, readonly unknown[]>,
  阶数: number,
  键数: number,
): number {
  let 结果 = 0;
  for (const 组 of 分布.values()) {
    结果 += 阶数 === 0 ? 组.length - 1 : 组.length ** 2 / (2 * 键数 ** 阶数);
  }
  return 结果;
}

export function 重码对象(
  分布: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  return new Set([...分布.values()].filter((组) => 组.length > 1).flat());
}

/** 指定元素合并后，新进入重码组的对象；与前端「边际一阶」口径相同。 */
export function 分析边际重码(
  配置: 离散分析配置,
  条目: readonly 组装条目[],
  最大码长: number,
  合并组列表: readonly (readonly 强类型元素位或编码[])[],
  按对象去重 = false,
) {
  const 原始分布 = 分析原始重码(配置, 条目, 最大码长, [], 按对象去重);
  const 合并分布 = 分析原始重码(配置, 条目, 最大码长, 合并组列表, 按对象去重);
  const 原始对象 = 重码对象(原始分布);
  return {
    原始分布,
    合并分布,
    新增对象: [...重码对象(合并分布)].filter((词) => !原始对象.has(词)),
  };
}
