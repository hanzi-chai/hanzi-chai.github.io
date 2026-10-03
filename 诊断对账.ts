/**
 * 诊断/对账：手动分析路径 vs 智能选根核心路径 的逐表分数
 * 复现网页「手动分析 总初态」与「自动搜索 前分(总分基)」两条独立计算管线，
 * 用同一份配置+词典输入，逐表打印两路结果与差值。
 * 用法: bun 诊断对账.ts [配置yaml路径，默认 D:/chai魔改/双乱.yaml]
 */
import { readFileSync } from "fs";
import { inflateSync } from "node:zlib";
import { load as yamlLoad } from "js-yaml";
import { range } from "lodash-es";
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
  是强类型归并,
  type 组装条目,
  type 强类型元素位或编码,
} from "hanzi-chai";
import { 智能选根核心, 展开表模式 } from "./src/lib/智能选根核心";

const 配置路径 = process.argv[2] ?? "D:/chai魔改/双乱.yaml";
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
console.log(`配置: ${配置路径}`);
console.log(`词典条数 ${原始词典.length}`);

const 内置字库数据 = JSON.parse(
  inflateSync(
    readFileSync(
      "D:/chai魔改/hanzi-chai.github.io/packages/hanzi-chai/src/data/repertoire.json.deflate",
    ),
  ).toString("utf-8"),
);

const mapping: Record<string, any> = 配置0.form?.mapping ?? {};
const maxLength: number = 配置0.encoder?.max_length ?? 4;
const alphabet: string = 配置0.form?.alphabet ?? "abcdefghijklmnopqrstuvwxyz";

// ================= 路径 C：智能选根核心（自动搜索的口径） =================
const 核心 = new 智能选根核心(配置0, 原始词典, 内置字库数据) as any;
核心.设置基态(mapping);
console.log(`\n[核心] 汉字集合 ${核心.汉字集合.size}，按频词序 ${核心.按频词序.length}，词条 ${核心.基态词序列.size}`);
console.log(`[核心] 总分基(裸) = ${核心.总分基}`);
const 核心表值 = new Map<string, number>();
核心.表组.forEach((t: any) => 核心表值.set(t.名, t.值));

// ================= 路径 M：手动分析面板的口径（复刻 cache.ts 原子链） =================
const 原始字库实例 = new 原始字库([
  ...内置字库数据,
  ...Object.values(配置0.data?.repertoire ?? {}),
]);
const 字库 = (
  原始字库实例.确定(
    标准化自定义(配置0.data?.glyph_customization ?? {}),
    配置0.data?.transformers ?? [],
    (配置0.data?.glyph_sources ?? []) as any,
  ) as any
).value;
const 词典 = 原始字库实例.校验词典(原始词典 as any);
// 全站管线：过滤词典 → 汉字集合（与 cache.ts 过滤词典原子/汉字集合原子一致）
const 字集指示 = 配置0.data?.character_set;
const 过滤词典 = 字集指示 ? 原始字库实例.过滤词典(词典, 字集指示) : 词典;
const 汉字集合 = 原始字库实例.获取汉字集合(过滤词典);
// 拼音元素映射用「词典原子」= 校验后未过滤（cache.ts 拼音元素映射原子口径）
const 拼写运算 = 合并拼写运算(配置0.algebra);
const 拼音元素映射 = 计算拼音分析与元素映射(词典, 拼写运算);
// 拼音分析结果用「过滤词典」（cache.ts 拼音分析结果原子口径）
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
const 强 = 构建强类型决策与决策空间(mapping, 配置0.form?.mapping_space ?? {}, 名称映射);
const 如线性化 = new 决策图(强.决策).线性化();
if (!如线性化.ok) throw 如线性化.error;

// 手动路径的组装（cache.ts 组装配置原子口径：组装器取 encoder.assembler ?? "默认"）
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
  自定义分析映射: new Map(),
  动态自定义分析映射: new Map(),
  字形来源列表: 配置0.data?.glyph_sources ?? [],
};
const 字形分析 = (字库 as any).分析(字形分析配置M, 汉字集合);
if (!字形分析.ok) throw 字形分析.error;
const 组装结果R = 组装(组装配置M, 拼音分析, 字形分析.value);
if (!组装结果R.ok) throw 组装结果R.error;

// 带归并处理（手动面板同款）
const 带归并 = ((): 组装条目[] => {
  const out: 组装条目[] = [];
  for (const 条目 of 组装结果R.value as 组装条目[]) {
    const 新元素序列: 强类型元素位或编码[] = [];
    for (const 码位 of 条目.元素序列.元素序列) {
      if (typeof 码位 === "string") {
        新元素序列.push(码位);
        continue;
      }
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
      新元素序列.push(cur);
    }
    out.push({ ...条目, 元素序列: { 元素序列: 新元素序列 } });
  }
  return out;
})();

// 统计手动组装的重复字条目（多音字/多序列）
const 词出现次数 = new Map<string, number>();
for (const 条目 of 带归并) {
  const 词 = 条目.词.map((c: any) => c.获取名称()).join("");
  if ([...词].length !== 1) continue;
  词出现次数.set(词, (词出现次数.get(词) ?? 0) + 1);
}
const 重复字 = [...词出现次数.entries()].filter(([, n]) => n > 1);
console.log(
  `\n[手动] 组装单字条目 ${[...词出现次数.values()].reduce((a, b) => a + b, 0)}（字 ${词出现次数.size}），多序列字 ${重复字.length} 个${重复字.length ? "：例 " + 重复字.slice(0, 10).map(([w, n]) => `${w}×${n}`).join(" ") : ""}`,
);

// 分组按模式 + 估计选重（手动面板同款：下转换、频率排序、top 截断；键按 maxLength 补齐与阶重序列键一致）
const 分组按模式 = (条目列表: 组装条目[], 空位: number[], top: number) => {
  const relevant = [...条目列表]
    .sort((a, b) => b.频率 - a.频率)
    .filter((x) => [...x.词].length === 1);
  const scope = top > 0 ? relevant.slice(0, top) : relevant;
  const map = new Map<string, string[]>();
  for (const 条目 of scope) {
    const 序列 = 条目.元素序列.元素序列;
    const 键 = JSON.stringify(
      range(maxLength).map((i) =>
        空位.includes(i)
          ? "*"
          : 序列[i] === undefined
            ? "ε"
            : 下转换M(序列[i]),
      ),
    );
    const 词 = 条目.词.map((c: any) => c.获取名称()).join("");
    map.set(键, [...(map.get(键) ?? []), 词]);
  }
  return map;
};
const 下转换M = (c: any) =>
  typeof c === "string" ? c : { element: c.element.获取名称(), index: c.index };
const 估计选重 = (分组: Map<string, string[]>, 空位: number[]) => {
  const space = alphabet.length ** 空位.length;
  let total = 0;
  分组.forEach((items) => {
    total +=
      空位.length === 0
        ? Math.max(0, items.length - 1)
        : (items.length * items.length) / 2 / space;
  });
  return total;
};

const 表列表 = (配置0.statistics?.tables ?? []) as any[];
let 手动总分 = 0;
console.log(`\n== 逐表对账（表名 | 核心值 | 手动值 | 差） ==`);
for (const t of 表列表) {
  const 模式 = 展开表模式(t);
  let 手动值 = 0;
  for (const 空位 of 模式) {
    手动值 += 估计选重(分组按模式(带归并, 空位, t.top ?? 0), 空位);
  }
  const 核心值 = 核心表值.get(t.name) ?? NaN;
  const 差 = Math.round((核心值 - 手动值) * 100) / 100;
  console.log(
    `${t.name}(w${t.weight},top${t.top ?? 0},模式${模式.length}): 核心=${核心值.toFixed(2)} 手动=${手动值.toFixed(2)} 差=${差}`,
  );
  手动总分 += t.weight * 手动值;
}
console.log(`\n总分：核心总分基=${核心.总分基.toFixed(2)}  手动加权总=${手动总分.toFixed(2)}  差=${(核心.总分基 - 手动总分).toFixed(2)}`);

// top 域诊断：核心 top-N 是全词典序（含字集外），手动 top-N 是组装条目序（仅字集内）
for (const t of 表列表) {
  const top = t.top ?? 0;
  if (!top) continue;
  const 域C = new Set(核心.按频词序.slice(0, top));
  const 有词条 = [...域C].filter((w: string) => 核心.基态词序列.has(w)).length;
  console.log(`top 域诊断[${t.name}]: 核心域前${top}字中实际有词条的 ${有词条} 个（缺 ${top - 有词条} 个=字集外/无拆分的高频字被核心跳过，但手动会补位）`);
}
