/**
 * 诊断/自测：组成部分挖掘（复合体开关双模式）
 * 用法: bun 诊断糹.ts
 */
import { readFileSync } from "fs";
import { inflateSync } from "node:zlib";
import { load as yamlLoad } from "js-yaml";
import { 默认退化配置, 是部件, 是复合体 } from "hanzi-chai";
import { 智能选根核心, 挖掘切片候选 } from "./src/lib/智能选根核心";

const 配置0: any = yamlLoad(readFileSync("D:/chai魔改/方案/选根/基线-尺素4仅笔画.yaml", "utf8"));
const 原始词典: { 词: string; 拼音: string[]; 频率: number }[] = [];
for (const line of readFileSync("D:/chai魔改/通规+GB+常用繁体（繁字拼音无效）.txt", "utf8").split("\n")) {
  const p = line.replace(/\r$/, "").split("\t");
  if (p.length < 3 || !p[0]) continue;
  原始词典.push({ 词: p[0], 拼音: p[1] ? p[1].split(" ") : [], 频率: Number(p[2]) });
}
const 频率表 = new Map(原始词典.map((d) => [d.词, d.频率]));
console.log(`词典条数 ${原始词典.length}`);

const 内置字库数据 = JSON.parse(
  inflateSync(readFileSync("D:/chai魔改/hanzi-chai.github.io/packages/hanzi-chai/src/data/repertoire.json.deflate")).toString("utf-8"),
);
const 核心 = new 智能选根核心(配置0, 原始词典, 内置字库数据) as any;
const { 字库, 字符对象映射, 汉字集合 } = 核心;
console.log(`分析字集大小: ${汉字集合.size}`);

// 字形类型抽样：糹应是复合体
for (const 名 of ["糹", "糸", "钅", "甘", "紅"]) {
  const c = 字符对象映射.get(名);
  const 字形 = c ? 字库.查询字形(c)?.[0] : undefined;
  console.log(`${名}: ${c ? "在分析字集" : "不在分析字集"}，字形=${字形 ? (是部件(字形) ? "部件" : 是复合体(字形) ? "复合体" : "?") : "无"}`);
}

console.log("\n== 模式A：仅叶部件（回归对照） ==");
let t0 = performance.now();
const 旧结果 = 挖掘切片候选(字库, 汉字集合, 频率表, 默认退化配置, undefined, { 允许复合体: false });
console.log(`耗时 ${((performance.now() - t0) / 1000).toFixed(1)}s，形状 ${旧结果.length} 个`);
const 旧按名 = new Map(旧结果.map((x) => [x.名, x]));
for (const 名 of ["糹", "糸", "纟", "钅", "甘"]) {
  const e = 旧按名.get(名);
  console.log(`  挖掘[${名}]: ${e ? `${e.次数}字` : "无条目（0 次）"}`);
}

console.log("\n== 模式B：允许复合体（新） ==");
t0 = performance.now();
const 新结果 = 挖掘切片候选(字库, 汉字集合, 频率表, 默认退化配置, undefined, { 允许复合体: true });
console.log(`耗时 ${((performance.now() - t0) / 1000).toFixed(1)}s，形状 ${新结果.length} 个`);
const 新按名 = new Map(新结果.map((x) => [x.名, x]));
for (const 名 of ["糹", "糸", "纟", "钅", "甘", "你"]) {
  const e = 新按名.get(名);
  console.log(`  挖掘[${名}]: ${e ? `${e.次数}字，前15: ${e.字列表.slice(0, 15).join("")}` : "无条目（0 次）"}`);
}
// 部件类计数回归：新口径按字去重，与旧 Σ叶子口径可有少量差异
let 回归差 = 0;
for (const [名, e] of 旧按名) {
  const n = 新按名.get(名);
  if (!n || n.次数 !== e.次数) 回归差++;
}
console.log(`部件类计数回归差（新按字去重所致，预期少量）: ${回归差}/${旧结果.length}`);
