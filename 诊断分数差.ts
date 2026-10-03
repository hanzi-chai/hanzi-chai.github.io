/**
 * 诊断：自动搜索前分 vs 手动分析总初态的差异来源——词典（字音 source 依赖）实测
 * 用法: bun 诊断分数差.ts
 */
import { readFileSync } from "fs";
import { inflateSync } from "node:zlib";
import { load as yamlLoad } from "js-yaml";
import { 智能选根核心 } from "./src/lib/智能选根核心";

const 内置字库数据 = JSON.parse(
  inflateSync(readFileSync("D:/chai魔改/hanzi-chai.github.io/packages/hanzi-chai/src/data/repertoire.json.deflate")).toString("utf-8"),
);

const 读词典 = (路径: string) => {
  const 原始词典: { 词: string; 拼音: string[]; 频率: number }[] = [];
  for (const line of readFileSync(路径, "utf8").split("\n")) {
    const p = line.replace(/\r$/, "").split("\t");
    if (p.length < 3 || !p[0]) continue;
    原始词典.push({ 词: p[0], 拼音: p[1] ? p[1].split(" ") : [], 频率: Number(p[2]) });
  }
  return 原始词典;
};

const 双乱配置: any = yamlLoad(readFileSync("D:/chai魔改/双乱.yaml", "utf8"));
const 首右配置: any = yamlLoad(readFileSync("C:/Users/RICHERD/Downloads/首右拼音_王治阳_1.0.0.yaml", "utf8"));
const 双乱词典 = 读词典("D:/chai魔改/通规混合GB字.txt");
const 首右词典 = 读词典("D:/chai魔改/通规+GB+常用繁体（繁字拼音无效）.txt");

const 基线分 = (核心: any) => {
  const { 强, 线性化, 准备, 分析结果 } = 核心.全量分析(核心.配置0.form.mapping);
  const r = 核心.运行组装(核心.配置0.form.mapping, 强, 线性化, 分析结果, 准备.字根部件列表);
  if (!r.ok) return { 失败: String(r.error ?? "组装失败") };
  const 词条 = 核心.条目提取(r);
  const 分 = 核心.全量计分(词条);
  return { 总分: Math.round(分.总分 * 100) / 100, 表值: 分.表值, 词条数: 词条?.size ?? Object.keys(词条 ?? {}).length };
};

console.log("== 双乱（形码，无字音 source） ==");
const 双乱核心 = new 智能选根核心(双乱配置, 双乱词典, 内置字库数据) as any;
双乱核心.设置基态(双乱配置.form.mapping);
console.log(`有词典: ${JSON.stringify(基线分(双乱核心))}`);
const 双乱核心空 = new 智能选根核心(双乱配置, [], 内置字库数据) as any;
双乱核心空.设置基态(双乱配置.form.mapping);
console.log(`空词典: ${JSON.stringify(基线分(双乱核心空))}`);

console.log("\n== 首右拼音（音形，字音 source 依赖词典） ==");
const 首右核心 = new 智能选根核心(首右配置, 首右词典, 内置字库数据) as any;
首右核心.设置基态(首右配置.form.mapping);
console.log(`有词典: ${JSON.stringify(基线分(首右核心))}`);
const 首右核心空 = new 智能选根核心(首右配置, [], 内置字库数据) as any;
首右核心空.设置基态(首右配置.form.mapping);
console.log(`空词典: ${JSON.stringify(基线分(首右核心空))}`);
