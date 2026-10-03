/** 快速探针：方案.yaml 的组装码位里有多少 index=undefined */
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
  type 组装条目,
} from "hanzi-chai";

const 配置0: any = yamlLoad(readFileSync("D:/chai魔改/方案/方案.yaml", "utf8"));
const 原始词典: any[] = [];
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
const 词典 = 原始字库实例.校验词典(原始词典);
const 拼音元素映射 = 计算拼音分析与元素映射(词典, 合并拼写运算(配置0.algebra));
const 拼音分析 = 分析拼音(拼音元素映射.拼音分析映射, 词典);
const 分类器 = 合并分类器(配置0.analysis?.classifier);
const 自定义元素映射 = 原始字库实例.校验自定义映射({}).自定义元素映射;
const 字符列表 = [...字库].map(({ 字符 }: any) => 字符);
const { 名称映射 } = 计算全部合法元素与元素映射(
  字符列表,
  分类器,
  拼音元素映射.拼音元素映射,
  自定义元素映射,
);
const mapping: Record<string, any> = 配置0.form?.mapping ?? {};
const 强 = 构建强类型决策与决策空间(mapping, 配置0.form?.mapping_space ?? {}, 名称映射);
const 线 = new 决策图(强.决策).线性化();
if (!线.ok) throw 线.error;
const 字形分析 = (字库 as any).分析(
  {
    分析配置: 配置0.analysis ?? {},
    决策: 强.决策,
    决策空间: 强.决策空间,
    线性化决策: 线.value,
    自定义分析映射: new Map(),
    动态自定义分析映射: new Map(),
    字形来源列表: 配置0.data?.glyph_sources ?? [],
  },
  原始字库实例.获取汉字集合(词典),
);
if (!字形分析.ok) throw 字形分析.error;
const 组装R = 组装(
  {
    源映射: 配置0.encoder?.sources,
    条件映射: 配置0.encoder?.conditions,
    线性化决策: 线.value,
    组装器: 配置0.encoder?.assembler ?? "默认",
    构词规则列表: 配置0.encoder?.rules ?? [],
    最大码长: 配置0.encoder?.max_length ?? 4,
    键盘配置: 配置0.form,
    自定义分析映射: new Map(),
    决策: 强.决策,
    决策空间: 强.决策空间,
    分类器,
  },
  拼音分析,
  字形分析.value,
);
if (!组装R.ok) throw 组装R.error;

let 总码位 = 0;
let 无index = 0;
const 样本: string[] = [];
const 按元素名 = new Map<string, number>();
for (const 条目 of 组装R.value as 组装条目[]) {
  const 词 = 条目.词.map((c: any) => c.获取名称()).join("");
  if ([...词].length !== 1) continue;
  const 序 = 条目.元素序列.元素序列;
  for (const 码位 of 序) {
    if (typeof 码位 === "string") continue;
    总码位++;
    if ((码位 as any).index === undefined) {
      无index++;
      const 名 = (码位 as any).element?.获取名称?.() ?? "?";
      按元素名.set(名, (按元素名.get(名) ?? 0) + 1);
      if (样本.length < 6) {
        样本.push(词 + ":" + 名 + " 序长" + 序.length);
      }
    }
  }
}
console.log("单字码位总数", 总码位, "，index=undefined 的", 无index, "个");
console.log(
  "涉及元素:",
  [...按元素名.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => k + "×" + n).join(" "),
);
console.log("样本:", 样本.join(" | "));
for (const 条目 of 组装R.value as 组装条目[]) {
  const 词 = 条目.词.map((c: any) => c.获取名称()).join("");
  if (词 === "的") {
    console.log(
      "「的」序列:",
      JSON.stringify(
        条目.元素序列.元素序列.map((c: any) =>
          typeof c === "string" ? c : { element: c.element?.获取名称?.(), index: c.index },
        ),
      ),
    );
    break;
  }
}

// 追加：短序列统计
const 长度分布 = new Map<number, number>();
for (const 条目 of 组装R.value as 组装条目[]) {
  const 词 = 条目.词.map((c: any) => c.获取名称()).join("");
  if ([...词].length !== 1) continue;
  const l = 条目.元素序列.元素序列.length;
  长度分布.set(l, (长度分布.get(l) ?? 0) + 1);
}
console.log("序列长度分布:", [...长度分布.entries()].sort((a, b) => a[0] - b[0]).map(([l, n]) => "长" + l + "×" + n).join(" "));
