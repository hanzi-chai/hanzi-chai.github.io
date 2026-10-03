/**
 * 诊断：逐字对比 智能选根核心（自动搜索口径） 与 手动分析面板口径 的元素序列。
 * 用法: bun 诊断序列对照.ts [配置yaml路径]
 */
import { readFileSync } from "fs";
import { inflateSync } from "node:zlib";
import { load as yamlLoad } from "js-yaml";
import {
  原始字库,
  分析拼音,
  计算拼音分析与元素映射,
  合并拼写运算,
  合并分类器,
  构建强类型决策与决策空间,
  决策图,
  组装,
  标准化自定义,
  计算全部合法元素与元素映射,
  构建强类型自定义分析,
  是强类型归并,
  下转换,
} from "hanzi-chai";
import { 智能选根核心 } from "./src/lib/智能选根核心";

const 配置路径 = process.argv[2] ?? "D:/chai魔改/首右拼音_王治阳_1.0.0 (1).yaml";
const 配置0: any = yamlLoad(readFileSync(配置路径, "utf8"));
const 原始词典: { 词: string; 拼音: string[]; 频率: number }[] = [];
for (const line of readFileSync(
  "D:/chai魔改/通规+GB+常用繁体（繁字拼音无效）.txt",
  "utf8",
).split("\n")) {
  const p = line.replace(/\r$/, "").split("\t");
  if (p.length < 3 || !p[0]) continue;
  原始词典.push({ 词: p[0], 拼音: p[1] ? p[1].split(" ") : [], 频率: Number(p[2]) });
}

const 内置字库数据 = JSON.parse(
  inflateSync(
    readFileSync(
      "D:/chai魔改/hanzi-chai.github.io/packages/hanzi-chai/src/data/repertoire.json.deflate",
    ),
  ).toString("utf-8"),
);

const mapping: Record<string, any> = 配置0.form?.mapping ?? {};
const maxLength: number = 配置0.encoder?.max_length ?? 4;

// ---------- 核心 ----------
const 核心 = new 智能选根核心(配置0, 原始词典, 内置字库数据) as any;
核心.设置基态(mapping);
const 核心词条 = new Map<string, { element: string; index: number }[]>();
for (const [w, 串] of 核心.基态词序列 as Map<string, string>) {
  核心词条.set(w, JSON.parse(串));
}

// ---------- 手动路径 ----------
const 原始字库实例 = new 原始字库([
  ...内置字库数据,
  ...Object.values(配置0.data?.repertoire ?? {}),
]);
const 字库 = (
  原始字库实例.确定(
    标准化自定义(配置0.data?.glyph_customization ?? {}),
    配置0.data?.transformers ?? [],
    (配置0.data?.glyph_sources ?? ["G"]) as any,
  ) as any
).value;
const 词典 = 原始字库实例.校验词典(原始词典 as any);
const 字集指示 = 配置0.data?.character_set ?? "general";
const 过滤词典 = 字集指示 ? 原始字库实例.过滤词典(词典, 字集指示) : 词典;
const 汉字集合 = 原始字库实例.获取汉字集合(过滤词典);
const 拼写运算 = 合并拼写运算(配置0.algebra);
const 拼音元素映射 = 计算拼音分析与元素映射(词典, 拼写运算);
const 拼音分析 = 分析拼音(拼音元素映射.拼音分析映射, 过滤词典);
const 分类器 = 合并分类器(配置0.analysis?.classifier);
const 自定义元素映射 = 原始字库实例.校验自定义映射({}).自定义元素映射;
const 字符列表 = [...字库].map(({ 字符 }: any) => 字符);
const { 名称映射 } = 计算全部合法元素与元素映射(
  字符列表,
  分类器,
  拼音元素映射.拼音元素映射,
  自定义元素映射,
);
const 自定义分析M = 构建强类型自定义分析(
  字库,
  原始字库实例,
  名称映射,
  配置0.analysis?.customize ?? {},
  配置0.analysis?.dynamic_customize ?? {},
);
const 强 = 构建强类型决策与决策空间(mapping, 配置0.form?.mapping_space ?? {}, 名称映射);
const 如线性化 = new 决策图(强.决策).线性化();
if (!如线性化.ok) throw 如线性化.error;

const 组装配置M = {
  源映射: 配置0.encoder?.sources,
  条件映射: 配置0.encoder?.conditions,
  线性化决策: 如线性化.value,
  组装器: 配置0.encoder?.assembler ?? "默认",
  构词规则列表: 配置0.encoder?.rules ?? [],
  最大码长: maxLength,
  键盘配置: 配置0.form,
  自定义分析映射: new Map(),
  决策: 强.决策,
  决策空间: 强.决策空间,
  分类器,
};
const 字形分析配置M = {
  分析配置: 配置0.analysis ?? {},
  决策: 强.决策,
  决策空间: 强.决策空间,
  线性化决策: 如线性化.value,
  自定义分析映射: 自定义分析M.自定义分析映射,
  动态自定义分析映射: 自定义分析M.动态自定义分析映射,
  字形来源列表: (配置0.data?.glyph_sources ?? ["G"]) as any[],
};
const 字形分析 = (字库 as any).分析(字形分析配置M, 汉字集合);
if (!字形分析.ok) throw 字形分析.error;
const 组装结果R = 组装(组装配置M, 拼音分析, 字形分析.value);
if (!组装结果R.ok) throw 组装结果R.error;

const 手动词条 = new Map<string, { element: string; index: number }[]>();
for (const 条目 of 组装结果R.value as any[]) {
  const 词 = 条目.词.map((c: any) => c.获取名称()).join("");
  if ([...词].length !== 1) continue;
  const 序列: any[] = [];
  for (const 码位 of 条目.元素序列.元素序列) {
    let cur: any = 码位;
    let i = 0;
    while (true) {
      i += 1;
      if (i > 100) break;
      const 安排 = (强.决策 as Map<any, any>).get(cur.element);
      if (!安排) break;
      if (是强类型归并(安排)) cur = { ...cur, element: 安排.element };
      else if (Array.isArray(安排)) {
        const 引 = 安排[cur.index];
        if (引 === undefined || typeof 引 === "string") break;
        cur = 引;
      } else break;
    }
    序列.push(
      typeof cur === "string" ? cur : { element: cur.element.获取名称(), index: cur.index ?? 0 },
    );
  }
  手动词条.set(词, 序列);
}

// ---------- 逐字对比 ----------
const 展示 = (s: { element: string; index: number }[] | undefined) =>
  s === undefined
    ? "（缺）"
    : JSON.stringify(s.map((c) => (typeof c === "string" ? c : `${c.element}${c.index ? "'" + c.index : ""}`)));

const 样字 = ["的", "一", "是", "了", "我", "不", "人", "在", "他", "有", "这", "中", "大", "来", "上", "国", "个", "到", "说", "们", "为", "子", "和", "你", "地", "出", "道", "也", "时", "年", "得", "就", "那", "要", "下", "以", "生", "会", "自", "着", "去", "之", "过", "家", "学", "对", "可", "她", "里", "后"];
let 差异数 = 0;
let 核心缺 = 0;
let 手动缺 = 0;
const 差异样本: string[] = [];
for (const w of 样字) {
  const a = 核心词条.get(w);
  const b = 手动词条.get(w);
  if (!a) 核心缺++;
  if (!b) 手动缺++;
  const sa = JSON.stringify(a ?? null);
  const sb = JSON.stringify(b ?? null);
  if (sa !== sb) {
    差异数++;
    if (差异样本.length < 25) 差异样本.push(`${w}: 核心=${展示(a)}  手动=${展示(b)}`);
  }
}
console.log(`样字 ${样字.length}：差异 ${差异数}，核心缺 ${核心缺}，手动缺 ${手动缺}`);
for (const s of 差异样本) console.log("  " + s);

// 全集统计：序列长度分布 + 必撞组规模分布
const 长度分布 = (m: Map<string, any>) => {
  const d = new Map<number, number>();
  for (const s of m.values()) d.set(s.length, (d.get(s.length) ?? 0) + 1);
  return [...d.entries()].sort((a, b) => a[0] - b[0]);
};
console.log(`\n核心序列长度分布: ${JSON.stringify(长度分布(核心词条))}`);
console.log(`手动序列长度分布: ${JSON.stringify(长度分布(手动词条))}`);

const 必撞组 = (m: Map<string, any>) => {
  const 组 = new Map<string, string[]>();
  for (const [w, s] of m) {
    const 键 = JSON.stringify(
      Array.from({ length: maxLength }, (_, i) =>
        s[i] === undefined ? "ε" : typeof s[i] === "string" ? s[i] : { element: s[i].element, index: s[i].index },
      ),
    );
    组.set(键, [...(组.get(键) ?? []), w]);
  }
  const 大小分布 = new Map<number, number>();
  let 总对 = 0;
  const 大组: [number, string[]][] = [];
  组.forEach((ws) => {
    大小分布.set(ws.length, (大小分布.get(ws.length) ?? 0) + 1);
    if (ws.length > 1) 总对 += ws.length - 1;
    if (ws.length >= 6) 大组.push([ws.length, ws]);
  });
  大组.sort((a, b) => b[0] - a[0]);
  return { 大小分布, 总对, 大组: 大组.slice(0, 10) };
};
const 核心组 = 必撞组(核心词条);
const 手动组 = 必撞组(手动词条);
console.log(`\n必撞 Σ(n-1)：核心=${核心组.总对}  手动=${手动组.总对}`);
console.log(`核心组大小分布: ${JSON.stringify([...核心组.大小分布.entries()].sort((a, b) => a[0] - b[0]).slice(0, 15))}`);
console.log(`手动组大小分布: ${JSON.stringify([...手动组.大小分布.entries()].sort((a, b) => a[0] - b[0]).slice(0, 15))}`);
console.log(`核心最大组: ${核心组.大组.map(([n, ws]) => `${n}[${ws.slice(0, 8).join("")}]`).join("  ")}`);
console.log(`手动最大组: ${手动组.大组.map(([n, ws]) => `${n}[${ws.slice(0, 8).join("")}]`).join("  ")}`);
