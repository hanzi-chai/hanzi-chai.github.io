/** 方案运行的公共流程。此模块不依赖文件系统、React 或 Worker。 */
import {
  动态组装,
  type 动态组装条目,
  组装,
  type 组装条目,
  type 组装配置,
} from "./assembly.js";
import { 合并分类器 } from "./classifier.js";
import type {
  优先简码,
  元素位或编码,
  条件,
  生成配置,
  目标配置,
  编码配置,
  配置,
} from "./config.js";
import type { 基本字形数据, 字符数据 } from "./data.js";
import type { 元素 } from "./element.js";
import { 分析拼音, 合并拼写运算 } from "./pinyin.js";
import { 字库, type 字形分析基本配置, 字形库 } from "./repertoire.js";
import {
  type Result,
  下转换,
  决策图,
  type 原始词典,
  type 强类型决策,
  type 强类型决策空间,
  type 当量映射,
  构建强类型决策与决策空间,
  构建强类型自定义分析,
  添加优先简码,
  生成,
  type 自定义分析,
  type 自定义分析映射,
  计算全部合法元素与元素映射,
  计算拼音分析与元素映射,
  识别符,
  type 键位分布目标,
} from "./utils.js";

export interface 方案诊断 {
  code: string;
  path: string;
  message: string;
}

export class 方案错误 extends Error {
  constructor(public readonly diagnostics: 方案诊断[]) {
    super(diagnostics.map((x) => `${x.path}: ${x.message}`).join("\n"));
    this.name = "方案错误";
  }
}

export function 解包结果<T>(result: Result<T, Error>, path: string): T {
  if (!result.ok)
    throw new 方案错误([
      { code: "ALGORITHM_ERROR", path, message: result.error.message },
    ]);
  return result.value;
}

export function 构建字库(
  配置: 配置,
  字符列表: 字符数据[],
  字形列表: 基本字形数据[],
) {
  return new 字库(
    [...字符列表, ...(配置.data?.characters ?? [])],
    new 字形库(
      [...字形列表, ...(配置.data?.glyphs ?? [])],
      配置.data?.glyph_algebra ?? [],
    ),
    配置.data?.glyph_sources ?? ["G"],
    配置.data?.character_customization ?? {},
  );
}

export function 构建字形分析配置(
  配置: Pick<配置, "analysis" | "data">,
  字库: 字库,
  名称映射: Map<string, 元素>,
  决策: 强类型决策,
  决策空间: 强类型决策空间,
  线性化决策: Map<元素, string>,
): 字形分析基本配置 {
  return {
    ...构建强类型自定义分析(
      字库,
      名称映射,
      配置.analysis?.customize ?? {},
      配置.analysis?.dynamic_customize ?? {},
    ),
    决策,
    决策空间,
    线性化决策,
    分析配置: 配置.analysis ?? {},
    字形来源列表: 配置.data?.glyph_sources ?? ["G"],
  };
}

export function 构建组装配置(
  配置: Pick<配置, "encoder" | "form" | "analysis" | "data">,
  决策: 强类型决策,
  决策空间: 强类型决策空间,
  线性化决策: Map<元素, string>,
  自定义分析映射: 自定义分析映射 = new Map(),
): 组装配置 {
  return {
    决策,
    决策空间,
    线性化决策,
    自定义分析映射,
    最大码长: 配置.encoder.max_length,
    源映射: 配置.encoder.sources,
    条件映射: 配置.encoder.conditions,
    构词规则列表: 配置.encoder.rules ?? [],
    组装器: 配置.encoder.assembler ?? "默认",
    键盘配置: 配置.form,
    分类器: 合并分类器(配置.analysis?.classifier),
    来源列表: 配置.data?.glyph_sources ?? ["G"],
  };
}

export function 构建优先简码映射(字库: 字库, 列表: 优先简码[]) {
  const map = new Map<string, number>();
  for (const { word, sources, level } of 列表) {
    const chars = [...word].map((char) => 字库.校验字符(char)?.character);
    // 无效条目整体忽略，避免误应用到删去缺字后的另一个词。
    if (chars.some((char) => char === undefined)) continue;
    map.set(
      识别符(chars as NonNullable<(typeof chars)[number]>[], sources),
      level,
    );
  }
  return map;
}

export interface 序列化组装条目 {
  词: string;
  全部元素序列: { 元素序列: 元素位或编码[]; 条件列表: 条件[] }[];
  频率: number;
  简码长度?: number;
}

/** 静态、动态组装共用同一种 libchai 输入格式。 */
export function 序列化组装结果(
  条目: ReturnType<typeof 添加优先简码<组装条目 | 动态组装条目>>,
): 序列化组装条目[] {
  return 条目.map(({ 词, 元素序列, ...rest }) => ({
    ...rest,
    词: 词.map((x) => x.获取名称()).join(""),
    全部元素序列:
      "元素序列" in 元素序列
        ? [{ 元素序列: 元素序列.元素序列.map(下转换), 条件列表: [] }]
        : [...元素序列].map((x) => ({
            元素序列: x.元素序列.map(下转换),
            条件列表: x.条件列表,
          })),
  }));
}

export interface 编码输入 {
  配置: 生成配置;
  词列表: 序列化组装条目[];
  原始键位分布信息: 键位分布目标;
  原始当量信息: 当量映射;
}

export function 构建编码输入(
  配置: 配置,
  词列表: 序列化组装条目[],
  原始键位分布信息: 键位分布目标,
  原始当量信息: 当量映射,
): 编码输入 {
  return { 配置: 生成(配置), 词列表, 原始键位分布信息, 原始当量信息 };
}

/** 与网页统计页保持一致；优化目标仍使用配置中的 optimization.objective。 */
export function 获取默认目标(encoder: 编码配置): 目标配置 {
  const levels = Array.from({ length: encoder.max_length }, (_, i) => ({
    length: i + 1,
    frequency: 1,
  }));
  const partial = {
    duplication: 1,
    key_distribution: 1,
    pair_equivalence: 1,
    fingering: [1, 1, 1, 1, 1, 1, null, null],
    levels,
  };
  const make = (tops: number[]) => ({
    ...partial,
    tiers: tops.map((top) => ({
      top: top || undefined,
      duplication: 1,
      levels,
      fingering: partial.fingering,
    })),
  });
  const characters = make([300, 500, 1500, 3000, 4500, 6000, 0]);
  const words = make([2000, 5000, 10000, 20000, 40000, 60000, 0]);
  const objective: 目标配置 = { characters_full: characters };
  if (encoder.rules?.length) objective.words_full = words;
  if (encoder.short_code?.length) {
    objective.characters_short = characters;
    if (
      encoder.rules?.length &&
      encoder.short_code.some((s) =>
        "length_equal" in s ? s.length_equal > 1 : s.length_in_range[1] > 1,
      )
    ) {
      objective.words_short = words;
    }
  }
  return objective;
}

export interface 方案数据 {
  字库: 字库;
  原始词典: 原始词典;
  自定义元素集合?: Record<string, 自定义分析>;
  键位分布目标?: 键位分布目标;
  当量映射?: 当量映射;
}

/** 先建立全局元素空间，再按字集过滤词典；拼音元素不会随评估范围漂移。 */
export function 准备方案(配置: 配置, 数据: 方案数据) {
  const { 字库 } = 数据;
  const 词典 = 字库.校验词典(数据.原始词典);
  const 过滤词典 = 字库.过滤词典(词典, 配置.data?.character_set ?? "general");
  const { 拼音分析映射, 拼音元素映射 } = 计算拼音分析与元素映射(
    词典,
    合并拼写运算(配置.algebra),
  );
  const { 自定义分析映射, 自定义元素映射 } = 字库.校验自定义映射(
    数据.自定义元素集合 ?? {},
  );
  const 字符列表 = [...字库].map(([, x]) => x.character);
  const 字形列表 = [...字库.字形迭代器()].map(([, x]) => x);
  const { 名称映射 } = 计算全部合法元素与元素映射(
    字符列表,
    字形列表,
    合并分类器(配置.analysis?.classifier),
    拼音元素映射,
    自定义元素映射,
  );
  const { 决策, 决策空间 } = 构建强类型决策与决策空间(
    配置.form.mapping,
    配置.form.mapping_space ?? {},
    名称映射,
  );
  const 线性化决策 = 解包结果(new 决策图(决策).线性化(), "/form/mapping");
  return {
    配置,
    数据,
    字库,
    词典,
    过滤词典,
    名称映射,
    决策,
    决策空间,
    线性化决策,
    汉字集合: 字库.获取汉字集合(过滤词典),
    拼音分析结果: 分析拼音(拼音分析映射, 过滤词典),
    字形分析配置: 构建字形分析配置(
      配置,
      字库,
      名称映射,
      决策,
      决策空间,
      线性化决策,
    ),
    组装配置: 构建组装配置(配置, 决策, 决策空间, 线性化决策, 自定义分析映射),
    优先简码映射: 构建优先简码映射(字库, 配置.encoder.short_code_list ?? []),
  };
}

export type 方案上下文 = ReturnType<typeof 准备方案>;

export function 分析方案(上下文: 方案上下文, 汉字集合 = 上下文.汉字集合) {
  const { 字库, 字形分析配置, 配置 } = 上下文;
  if (配置.analysis?.dynamic) {
    return {
      dynamic: true as const,
      value: 解包结果(字库.动态分析(字形分析配置, 汉字集合), "/analysis"),
    };
  }
  return {
    dynamic: false as const,
    value: 解包结果(字库.分析(字形分析配置, 汉字集合), "/analysis"),
  };
}

export function 运行方案(上下文: 方案上下文) {
  const 分析 = 分析方案(上下文);
  const { 组装配置, 拼音分析结果, 优先简码映射, 配置, 数据 } = 上下文;
  const 组装结果 = 分析.dynamic
    ? 解包结果(动态组装(组装配置, 拼音分析结果, 分析.value), "/encoder")
    : 解包结果(组装(组装配置, 拼音分析结果, 分析.value), "/encoder");
  const 词列表 = 序列化组装结果(
    添加优先简码<组装条目 | 动态组装条目>(组装结果, 优先简码映射),
  );
  return {
    分析,
    词列表,
    输入: 构建编码输入(
      配置,
      词列表,
      数据.键位分布目标 ?? new Map(),
      数据.当量映射 ?? new Map(),
    ),
  };
}

export interface 编码条目 {
  词: string;
  全码: string;
  全码排名: number;
  简码: string;
  简码排名: number;
}
export type 编码结果 = 编码条目[];

export interface 层级指标 {
  top?: number;
  duplication?: number;
  duplication_squared?: number;
  levels?: { length: number; frequency: number }[];
  fingering?: (number | null | undefined)[];
}
export interface 部分指标 extends 层级指标 {
  tiers?: 层级指标[];
  key_distribution?: Map<string, number> | Record<string, number>;
  key_distribution_loss?: number;
  pair_equivalence?: number;
  extended_pair_equivalence?: number;
}
export interface 评估指标 {
  complexity?: number;
  characters_full?: 部分指标;
  characters_short?: 部分指标;
  words_full?: 部分指标;
  words_short?: 部分指标;
}

export function 获取重码组(码表: 编码结果, 简码 = false) {
  const groups = new Map<string, Set<string>>();
  for (const 条目 of 码表) {
    const code = 简码 ? 条目.简码 : 条目.全码;
    if (!code) continue;
    const words = groups.get(code) ?? new Set<string>();
    words.add(条目.词);
    groups.set(code, words);
  }
  return [...groups]
    .filter(([, words]) => words.size > 1)
    .map(([code, words]) => ({ code, words: [...words] }))
    .sort(
      (a, b) => b.words.length - a.words.length || a.code.localeCompare(b.code),
    );
}
