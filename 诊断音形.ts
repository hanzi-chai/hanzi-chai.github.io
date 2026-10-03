/**
 * 诊断：①音元素删除的增量盲区实测 ②自动搜索分数 vs 手动分析分数的差异按表拆解
 * 用法: bun 诊断音形.ts
 */
import { readFileSync } from "fs";
import { inflateSync } from "node:zlib";
import { load as yamlLoad } from "js-yaml";
import { 智能选根核心 } from "./src/lib/智能选根核心";

const 配置0: any = yamlLoad(readFileSync("C:/Users/RICHERD/Downloads/首右拼音_王治阳_1.0.0.yaml", "utf8"));
const 原始词典: { 词: string; 拼音: string[]; 频率: number }[] = [];
for (const line of readFileSync("D:/chai魔改/通规+GB+常用繁体（繁字拼音无效）.txt", "utf8").split("\n")) {
  const p = line.replace(/\r$/, "").split("\t");
  if (p.length < 3 || !p[0]) continue;
  原始词典.push({ 词: p[0], 拼音: p[1] ? p[1].split(" ") : [], 频率: Number(p[2]) });
}
console.log(`词典条数 ${原始词典.length}`);
const 频率表 = new Map(原始词典.map((d) => [d.词, d.频率]));

const 内置字库数据 = JSON.parse(
  inflateSync(readFileSync("D:/chai魔改/hanzi-chai.github.io/packages/hanzi-chai/src/data/repertoire.json.deflate")).toString("utf-8"),
);
const 核心 = new 智能选根核心(配置0, 原始词典, 内置字库数据) as any;
const 基线mapping = 配置0.form.mapping;
核心.设置基态(基线mapping);
console.log(`基线根数 ${Object.keys(基线mapping).length}，总分基 ${Math.round(核心.总分基 * 100) / 100}`);

// ---------- ① 音元素删除盲区：增量 vs 全量 ----------
const 全量总分 = (变体mapping: Record<string, any>): { ok: boolean; 分?: number; 明细?: any; 词条?: any[] } => {
  try {
    const { 强, 线性化, 准备, 分析结果 } = 核心.全量分析(变体mapping);
    const r = 核心.运行组装(变体mapping, 强, 线性化, 分析结果, 准备.字根部件列表);
    if (!r.ok) return { ok: false };
    const 词条 = 核心.条目提取(r);
    const 分 = 核心.全量计分(词条);
    return { ok: true, 分, 明细: 分, 词条 };
  } catch (e) {
    return { ok: false };
  }
};

for (const 删根 of ["鹤声-a", "鹤韵-ai", "鹤声-q"]) {
  console.log(`\n—— 删 ${删根} ——`);
  const 变体 = 核心.变体mapping(基线mapping, [], [删根]);
  const 增量 = 核心.评变体(变体) as any;
  if (增量.失败) console.log(`  增量：失败（${增量.失败}）`);
  else console.log(`  增量：总分 ${Math.round(增量.总分 * 100) / 100}`);
  const 全 = 全量总分(变体);
  if (!全.ok) console.log("  全量：失败");
  else console.log(`  全量：总分 ${Math.round((全.分 as any).总分 !== undefined ? 全.分.总分 : 全.分) }`);
  if (增量.失败 || !全.ok) continue;
  const 全分 = (全.分 as any).总分 !== undefined ? 全.分.总分 : 全.分;
  const 差 = Math.abs(增量.总分 - 全分);
  console.log(`  ${差 < 0.01 ? "✅ 一致" : `❌ 不一致，差 ${Math.round(差 * 100) / 100}（盲区实锤）`}`);
}

// ---------- ② 分数构成：全量计分的各表明细（对照手动分析的 21 万） ----------
console.log("\n—— 基线各表得分明细（对照手动分析总初态 214871.07） ——");
const 基线全量 = 全量总分(基线mapping);
if (基线全量.ok) {
  const 明细 = 基线全量.明细 as any;
  console.log(`全量计分返回结构: ${Object.keys(明细).join("、")}`);
  for (const k of Object.keys(明细)) {
    const v = 明细[k];
    if (typeof v === "number") console.log(`  ${k}: ${Math.round(v * 100) / 100}`);
    else if (Array.isArray(v)) console.log(`  ${k}: [${v.length} 项] ${JSON.stringify(v).slice(0, 400)}`);
    else if (v && typeof v === "object") console.log(`  ${k}: ${JSON.stringify(v).slice(0, 400)}`);
  }
}

// ---------- ③ 手动分析口径复算：同映射同字集，逐表对照 ----------
console.log("\n—— ③ 手动口径复算（同数据逐表） vs 核心表值 ——");
const 原始词条容器 = 基线全量.词条 as any;
const 条目列表: { 名: string; 序列: any; 频率: number }[] = [];
for (const [名, v] of 原始词条容器?.entries?.() ?? []) {
  条目列表.push({ 名, 序列: (v as any)?.元素序列, 频率: (v as any)?.频率 ?? -1 });
}
console.log(`词条数 ${条目列表.length}，有效码位序列 ${条目列表.filter((x) => Array.isArray(x.序列)).length}，样例: ${JSON.stringify(条目列表[0]?.序列)?.slice(0, 200)}`);
const 下转换 = (await import("hanzi-chai")).下转换 as (c: any) => any;
const 字母表大小 = (配置0.form.alphabet ?? "abcdefghijklmnopqrstuvwxyz").length;
for (const t of 配置0.statistics.tables ?? []) {
  let 总 = 0;
  for (const 空位 of t.patterns ?? []) {
    const relevant = [...条目列表].sort((a, b) => b.频率 - a.频率);
    const scope = t.top > 0 ? relevant.slice(0, t.top) : relevant;
    const map = new Map<string, string[]>();
    for (const 条目 of scope) {
      if (!Array.isArray(条目.序列)) continue; // 无解/异常字跳过（与真实面板的数组化条目对齐）
      const 键 = JSON.stringify(
        条目.序列.map((码位: any, i: number) => {
          if (空位.includes(i)) return "*";
          return typeof 码位 === "string" ? 码位 : { element: 码位.element, index: 码位.index };
        }),
      );
      map.set(键, [...(map.get(键) ?? []), 条目.名]);
    }
    const space = 字母表大小 ** 空位.length;
    map.forEach((items) => {
      总 += 空位.length === 0 ? Math.max(0, items.length - 1) : (items.length * items.length) / 2 / space;
    });
  }
  console.log(`  ${t.name}: 手动口径 ${Math.round(总 * 100) / 100} × w${t.weight} = ${Math.round(总 * t.weight * 100) / 100}`);
}
