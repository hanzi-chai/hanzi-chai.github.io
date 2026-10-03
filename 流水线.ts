/**
 * 拆分流水线：方案 YAML + 自定义词典 → 元素序列表 (elements.yaml)
 * 用法: bun 流水线.ts <方案yaml路径> <自定义词典路径> <输出elements路径>
 * 注意：词典与字库必须来自同一个 原始字库 实例（字符对象身份一致）。
 */
import { readFileSync, writeFileSync } from "fs";
import yaml from "js-yaml";
import {
  获取原始字库,
  获取拼音分析结果,
  获取组装结果,
  计算拼音分析与元素映射,
  合并拼写运算,
  获取决策与决策空间,
  决策图,
  计算全部合法元素与元素映射,
  标准化自定义,
  合并分类器,
} from "./packages/hanzi-chai/dist/index.js";
import { 构建强类型自定义分析 } from "./packages/hanzi-chai/dist/utils.js";
import type { 配置, 原始词典 } from "./packages/hanzi-chai/dist/index.js";

const [, , 配置路径, 词典路径, 输出路径] = process.argv;
if (!配置路径 || !词典路径 || !输出路径) {
  console.error("用法: bun 流水线.ts <方案yaml> <自定义词典.txt> <输出elements.yaml>");
  process.exit(1);
}

const 配置 = yaml.load(readFileSync(配置路径, "utf8")) as 配置;

// 1. 加载自定义词典（字\t拼音\t频率）
const 原始词典: 原始词典 = [];
for (const line of readFileSync(词典路径, "utf8").split("\n")) {
  const parts = line.replace(/\r$/, "").split("\t");
  if (parts.length < 3 || !parts[0]) continue;
  原始词典.push({ 词: parts[0], 拼音: parts[1].split(" "), 频率: Number(parts[2]) });
}
console.log(`词典条目: ${原始词典.length}`);

// 2. 单一原始字库实例：附带方案自定义字根字符（如虎码 PUA 字根）
const 原始字库 = 获取原始字库(Object.values(配置.data?.repertoire ?? {}));
const 词典 = 原始字库.校验词典(原始词典);
console.log(`校验后词典: ${词典.length}`);

// 3. 由同一实例确定字库（应用字形自定义/变换器/字形来源；来源默认与站点一致取 G）
const 字库结果 = 原始字库.确定(
  标准化自定义(配置.data?.glyph_customization ?? {}),
  配置.data?.transformers ?? [],
  (配置.data?.glyph_sources ?? ["G"]) as any,
);
if (!字库结果.ok) throw 字库结果.error;
const 字库 = 字库结果.value;
console.log(`字库大小: ${[...字库].length}`);

// 4. 拼音分析（与站点 cache.ts 同口径：过滤词典；拼音元素单次计算共享）
const 字集指示 = 配置.data?.character_set;
const 过滤词典 = 字集指示 ? 原始字库.过滤词典(词典, 字集指示 as any) : 词典;
const { 拼音元素映射, 拼音分析映射 } = 计算拼音分析与元素映射(词典, 合并拼写运算(配置.algebra));
const 拼音分析 = 获取拼音分析结果(拼音分析映射, 过滤词典);
console.log(`拼音分析: ${拼音分析.length}`);

// 5. 合法元素映射（全字库范围，与 e2e 一致）
const 字符列表 = [...字库].map(({ 字符 }) => 字符);
const 分类器 = 合并分类器(配置.analysis?.classifier);
const 自定义元素映射 = 原始字库.校验自定义映射({}).自定义元素映射;
const { 名称映射 } = 计算全部合法元素与元素映射(
  字符列表,
  分类器,
  拼音元素映射,
  自定义元素映射,
);

// 6. 字形分析（仅分析词典内的字；内联实现以保证实例一致）
const { 自定义分析映射, 动态自定义分析映射 } = 构建强类型自定义分析(
  字库,
  原始字库,
  名称映射,
  配置.analysis?.customize ?? {},
  (配置.analysis as any)?.dynamic_customize ?? {},
);
const { 决策: 决策2, 决策空间: 决策空间2 } = 获取决策与决策空间(配置, 字库, 词典, 原始字库, 名称映射);
const 如线性化决策2 = new 决策图(决策2).线性化();
if (!如线性化决策2.ok) throw 如线性化决策2.error;
const 字形分析结果 = (字库 as any).分析(
  {
    决策: 决策2,
    决策空间: 决策空间2,
    自定义分析映射,
    动态自定义分析映射,
    分析配置: 配置.analysis ?? {},
    字形来源列表: (配置.data?.glyph_sources ?? ["G"]) as any[],
    线性化决策: 如线性化决策2.value,
  },
  原始字库.获取汉字集合(过滤词典),
);
if (!字形分析结果.ok) throw 字形分析结果.error;
const 分析结果 = (字形分析结果.value as any).分析结果 as Map<any, any[]>;
const 有分析数 = [...分析结果.values()].filter((x) => x.length > 0).length;
console.log(`字形分析: ${分析结果.size} 字, 其中有分析 ${有分析数} 字`);
if (有分析数 === 0) throw new Error("字形分析全部为空，请检查方案配置");

// 7. 决策与组装（同一份名称映射，避免拼音元素对象二次构建）
const { 决策, 决策空间 } = 获取决策与决策空间(配置, 字库, 词典, 原始字库, 名称映射);
const 线性化决策 = new 决策图(决策).线性化();
if (!线性化决策.ok) throw 线性化决策.error;
const 组装 = 获取组装结果(配置, 决策, 决策空间, 线性化决策.value, 拼音分析, 字形分析结果.value);
if (!组装.ok) throw 组装.error;
console.log(`组装结果: ${组装.value.length}`);

// 8. 导出元素序列表
const 条目 = 组装.value.map((x) => ({
  词: x.词.map((v: any) => v.获取名称()).join(""),
  元素序列: x.元素序列.元素序列.map((c: any) =>
    typeof c === "string" ? c : { element: c.element.获取名称(), index: c.index },
  ),
  频率: x.频率,
}));
writeFileSync(输出路径, yaml.dump(条目, { lineWidth: -1 }), "utf8");
console.log(`元素序列表: ${条目.length} 条 → ${输出路径}`);

// 9. 输出 CLI 用配置（补 generated_mapping_space：libchai 的元素表来自决策空间）
const CLI配置: any = structuredClone(配置);
CLI配置.generated_mapping_space = Object.fromEntries(
  Object.entries(配置.form.mapping).map(([名称, 安排]) => [名称, [{ value: 安排, score: 0 }]]),
);
const CLI路径 = 输出路径.replace(/\.ya?ml$/, "") + "-配置.yaml";
writeFileSync(CLI路径, yaml.dump(CLI配置, { lineWidth: -1 }), "utf8");
console.log(`CLI配置 → ${CLI路径}`);
