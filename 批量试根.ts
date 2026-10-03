/**
 * 批量试根：虎码示例方案 + 若干候选根，逐根重拆分并计算各阶重变化
 * 用法: bun 批量试根.ts
 */
import { readFileSync } from "fs";
import yaml from "js-yaml";
import {
  下转换,
  获取原始字库,
  获取拼音分析结果,
  获取决策与决策空间,
  计算拼音分析与元素映射,
  合并拼写运算,
  决策图,
  计算全部合法元素与元素映射,
  构建强类型自定义分析,
  组装,
  标准化自定义,
  合并分类器,
} from "./packages/hanzi-chai/dist/index.js";
import type { 配置, 原始词典, 组装条目 } from "./packages/hanzi-chai/dist/index.js";

const ROOT = "D:/chai魔改";
const 试根列表 = ["㝵", "氐", "曷", "臾", "丱", "巛"];

const 配置 = yaml.load(readFileSync(`${ROOT}/方案/方案.yaml`, "utf8")) as 配置;
const 原始词典: 原始词典 = [];
for (const line of readFileSync(`${ROOT}/方案/自定义词典.txt`, "utf8").split("\n")) {
  const parts = line.replace(/\r$/, "").split("\t");
  if (parts.length < 3 || !parts[0]) continue;
  原始词典.push({ 词: parts[0], 拼音: parts[1].split(" "), 频率: Number(parts[2]) });
}
const 原始字库 = 获取原始字库(Object.values(配置.data?.repertoire ?? {}));
const 词典 = 原始字库.校验词典(原始词典);
const 字库 = (原始字库.确定(
  标准化自定义(配置.data?.glyph_customization ?? {}),
  配置.data?.transformers ?? [],
  (配置.data?.glyph_sources ?? ["G"]) as any,
) as any).value;
// 与站点 cache.ts 同口径：按方案字集过滤词典（汉字集合、分析拼音都用过滤词典）
const 字集指示 = 配置.data?.character_set ?? "general";
const 过滤词典 = 字集指示 ? 原始字库.过滤词典(词典, 字集指示 as any) : 词典;
// 拼音元素只计算一次：名称映射/决策/拼音分析共享同一批拼音元素对象
const { 拼音元素映射, 拼音分析映射 } = 计算拼音分析与元素映射(词典, 合并拼写运算(配置.algebra));
const 拼音分析 = 获取拼音分析结果(拼音分析映射, 过滤词典);
const 分类器 = 合并分类器(配置.analysis?.classifier);
const 字符列表 = [...字库].map(({ 字符 }) => 字符);
const 自定义元素映射 = 原始字库.校验自定义映射({}).自定义元素映射;
const { 名称映射 } = 计算全部合法元素与元素映射(字符列表, 分类器, 拼音元素映射, 自定义元素映射);
// analysis.customize 强类型化（与核心/面板同口径），字形分析须传入
const 自定义分析 = 构建强类型自定义分析(
  字库,
  原始字库,
  名称映射,
  配置.analysis?.customize ?? {},
  配置.analysis?.dynamic_customize ?? {},
);
const 汉字集合 = 原始字库.获取汉字集合(过滤词典);

function 组装词表(额外根: Record<string, string>): Map<string, string> {
  const 配置变体 = {
    ...配置,
    form: { ...配置.form, mapping: { ...配置.form.mapping, ...额外根 } },
  } as 配置;
  const 强 = 获取决策与决策空间(配置变体, 字库, 词典, 原始字库, 名称映射);
  const 线性化 = new 决策图(强.决策).线性化();
  if (!线性化.ok) throw 线性化.error;
  const 分析 = (字库 as any).分析(
    {
      分析配置: 配置.analysis ?? {},
      决策: 强.决策,
      决策空间: 强.决策空间,
      线性化决策: 线性化.value,
      自定义分析映射: 自定义分析.自定义分析映射,
      动态自定义分析映射: 自定义分析.动态自定义分析映射,
      字形来源列表: (配置.data?.glyph_sources ?? ["G"]) as any[],
    },
    汉字集合,
  );
  if (!分析.ok) throw 分析.error;
  const r = 组装(
    {
      源映射: 配置.encoder.sources,
      条件映射: 配置.encoder.conditions,
      线性化决策: 线性化.value,
      组装器: undefined,
      构词规则列表: 配置.encoder.rules ?? [],
      最大码长: 配置.encoder.max_length,
      键盘配置: 配置.form,
      自定义分析映射: new Map(),
      决策: 强.决策,
      决策空间: 强.决策空间,
      分类器: 合并分类器(配置.analysis?.classifier),
    },
    拼音分析,
    分析.value,
  );
  if (!r.ok) throw r.error;
  const map = new Map<string, string>();
  for (const 条目 of r.value as 组装条目[]) {
    const 词 = 条目.词.map((c: any) => c.获取名称()).join("");
    map.set(
      词,
      条目.元素序列.元素序列
        .map((c: any) =>
          typeof c === "string" ? `[${c}]` : `${c.element.获取名称()}${c.index ? "'" + c.index : ""}`,
        )
        .join(" "),
    );
  }
  return map;
}

const combinations = (n: number, k: number): number[][] => {
  const out: number[][] = [];
  const dfs = (s: number, cur: number[]) => {
    if (cur.length === k) return void out.push([...cur]);
    for (let i = s; i < n; i++) dfs(i + 1, [...cur, i]);
  };
  dfs(0, []);
  return out;
};
const 全部模式 = [0, 1, 2, 3, 4].flatMap((j) => combinations(4, j));

const 分组 = (序列表: Map<string, string>, 空位: number[], 词频: Map<string, number>) => {
  const 相关 = [...序列表.entries()]
    .filter(([词]) => [...词].length === 1)
    .sort((a, b) => (词频.get(b[0]) ?? 0) - (词频.get(a[0]) ?? 0));
  const map = new Map<string, string[]>();
  for (const [词, seq] of 相关) {
    const keys = seq.split(" ");
    const 键 = JSON.stringify(keys.map((k, i) => (空位.includes(i) ? "*" : k)));
    map.set(键, [...(map.get(键) ?? []), 词]);
  }
  return map;
};

const 阶重估计 = (分组: Map<string, string[]>, 空位: number[]) => {
  const space = 26 ** 空位.length;
  let t = 0;
  分组.forEach((v) => {
    t += 空位.length === 0 ? Math.max(0, v.length - 1) : (v.length * v.length) / 2 / space;
  });
  return t;
};

const 词频 = new Map<string, number>();
for (const line of readFileSync(`${ROOT}/方案/自定义词典.txt`, "utf8").split("\n")) {
  const p = line.split("\t");
  if (p.length === 3) 词频.set(p[0], Number(p[2]));
}

console.log("计算基线……");
const 基线表 = 组装词表({});

for (const 根 of 试根列表) {
  if (!名称映射.has(根)) {
    console.log(`\n### 根「${根}」不是合法元素，跳过`);
    continue;
  }
  if ((配置.form.mapping as any)[根] !== undefined) {
    console.log(`\n### 根「${根}」已在映射中，跳过`);
    continue;
  }
  console.log(`\n########## 加根「${根}」 ##########`);
  const 候选表 = 组装词表({ [根]: "aa" });
  let 变化数 = 0;
  const 变化样例: string[] = [];
  for (const [词, seq] of 基线表) {
    const 新 = 候选表.get(词);
    if (新 !== seq) {
      变化数++;
      if (变化样例.length < 10) 变化样例.push(`${词}: ${seq} → ${新}`);
    }
  }
  console.log(`变化字数: ${变化数}`);
  变化样例.forEach((x) => console.log("  " + x));
  let 总降低 = 0;
  const 阶小计 = [0, 0, 0, 0, 0];
  for (const 空位 of 全部模式) {
    const b = 阶重估计(分组(基线表, 空位, 词频), 空位);
    const c = 阶重估计(分组(候选表, 空位, 词频), 空位);
    阶小计[空位.length] += b - c;
    总降低 += b - c;
  }
  console.log(
    `各阶降低: 零阶 ${阶小计[0].toFixed(2)} | 一阶 ${阶小计[1].toFixed(2)} | 二阶 ${阶小计[2].toFixed(2)} | 三阶 ${阶小计[3].toFixed(2)} | 四阶 ${阶小计[4].toFixed(2)}`,
  );
  console.log(`总降低（全部模式）: ${总降低.toFixed(2)}`);
}
