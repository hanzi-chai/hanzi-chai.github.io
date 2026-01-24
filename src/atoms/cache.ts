import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { MiniDb } from "jotai-minidb";
import { sortBy } from "lodash-es";
import pako from "pako";
import type { Metric } from "~/components/MetricTable";
import type {
  Result,
  原始字库数据,
  字形分析结果,
  当量映射,
  码位,
  组装条目,
  自定义分析,
  词典,
  键位分布目标,
} from "~/lib";
import {
  default_err,
  ok,
  分析拼音,
  原始字库,
  合并拼写运算,
  图形盒子,
  展开决策,
  总序列化,
  是归并,
  是私用区,
  获取汉字集合,
  解析当量映射,
  解析词典,
  解析键位分布目标,
  识别符,
  读取表格,
  默认分类器,
  默认拼音分析器,
} from "~/lib";
import { thread, type 编码条目, type 编码结果 } from "~/utils";
import {
  优先简码原子,
  决策原子,
  决策空间原子,
  分析配置原子,
  变换器列表原子,
  字形自定义原子,
  拼写运算自定义原子,
  用户原始字库数据原子,
  用户标签列表原子,
  编码配置原子,
  键盘原子,
  默认目标原子,
} from ".";
import { 配置原子 } from "./config";

const 资源缓存: Record<string, string> = {};

export async function 拉取资源(文件名: string) {
  // 检查缓存
  if (文件名 in 资源缓存) {
    return 资源缓存[文件名]!;
  }
  try {
    const 响应 = await fetch(`/cache/${文件名}`);
    if (!响应.ok) {
      throw new Error(`获取资源失败: ${文件名}, 状态码: ${响应.status}`);
    }
    let 文本: string;
    if (文件名.endsWith(".deflate")) {
      文本 = await 处理压缩文件(文件名, 响应);
    } else {
      文本 = await 响应.text();
    }
    // 缓存结果
    资源缓存[文件名] = 文本;
    return 文本;
  } catch (error) {
    console.error(`处理资源时出错: ${文件名}`, error);
    throw error;
  }
}

async function 处理压缩文件(filename: string, response: Response) {
  const name = filename.replace(/\.deflate$/, "");
  const arrayBuffer = await response.arrayBuffer();
  try {
    const content = pako.inflate(arrayBuffer, { to: "string" });
    return content;
  } catch {
    throw new Error(`解压文件失败: ${name}`);
  }
}

// 服务器资源

export const 原始字库数据原子 = atom(async () => {
  const content = await 拉取资源("repertoire.json.deflate");
  const data: 原始字库数据 = JSON.parse(content);
  return data;
});

export const 默认词典原子 = atom(async () => {
  const content = await 拉取资源("dictionary.txt");
  return 解析词典(读取表格(content));
});

export const 默认键位分布目标原子 = atom(async () => {
  const content = await 拉取资源("key_distribution.txt");
  return 解析键位分布目标(读取表格(content));
});

export const 默认当量原子 = atom(async () => {
  const content = await 拉取资源("pair_equivalence.txt");
  return 解析当量映射(读取表格(content));
});

// 用户数据存储
const db = new MiniDb<词典>();

export const 用户词典原子 = db.item("user_dictionary");

export const 用户键位分布原子 = atomWithStorage<键位分布目标 | undefined>(
  "user_key_distribution",
  undefined,
);

export const 用户双键当量原子 = atomWithStorage<当量映射 | undefined>(
  "user_pair_equivalence",
  undefined,
);

export const 自定义元素集合原子 = atomWithStorage<Record<string, 自定义分析>>(
  "custom_elements",
  {},
);

export const 词典原子 = atom(async (get) => {
  return get(用户词典原子) ?? (await get(默认词典原子));
});

export const 自定义元素映射原子 = atom((get) => {
  const 自定义元素集合 = get(自定义元素集合原子);
  const 查找表 = new Map<string, Record<string, string[]>>();
  for (const [类别, 映射] of Object.entries(自定义元素集合)) {
    for (const [汉字, 元素列表] of Object.entries(映射)) {
      const 记录 = 查找表.get(汉字) ?? {};
      记录[类别] = 元素列表;
      查找表.set(汉字, 记录);
    }
  }
  return 查找表;
});

export const 汉字集合原子 = atom(async (get) => {
  const 词典 = await get(词典原子);
  return 获取汉字集合(词典);
});

export const 原始字库原子 = atom(async (get) => {
  const 原始字库数据 = await get(原始字库数据原子);
  const 用户原始字库数据 = get(用户原始字库数据原子);
  return new 原始字库({ ...原始字库数据, ...用户原始字库数据 });
});

export const 别名显示原子 = atom(async (get) => {
  const 原始字库 = await get(原始字库原子);
  return (字符: string) => {
    if (!是私用区(字符)) return 字符;
    const name = 原始字库.查询(字符)?.name;
    return name ?? "丢失的字根";
  };
});

export const 如确定字库原子 = atom(async (get) => {
  const 原始字库 = await get(原始字库原子);
  const 字形自定义 = get(字形自定义原子);
  const 用户标签列表 = get(用户标签列表原子);
  return 原始字库.确定(字形自定义, 用户标签列表);
});

export const 如字库原子 = atom(async (get) => {
  const 如确定字库 = await get(如确定字库原子);
  if (!如确定字库.ok) return 如确定字库;
  const 变换器列表 = get(变换器列表原子);
  let 字库 = 如确定字库.value;
  for (const 变换器 of 变换器列表) {
    console.log("应用变换器:", 变换器);
    字库 = 字库.应用变换器(变换器);
  }
  return ok(字库);
});

export const 如私用区图形原子 = atom(async (get) => {
  const 如字库 = await get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 字库 = 如字库.value;
  const result = new Map<string, 图形盒子>();
  for (const [字符, { glyph }] of Object.entries(字库._get())) {
    if (!是私用区(字符)) continue;
    if (result.has(字符)) continue;
    if (glyph.type === "basic_component") {
      result.set(字符, 图形盒子.从笔画列表构建(glyph.strokes));
    } else {
      const 如图形盒子 = 字库.递归渲染复合体(glyph, result);
      if (!如图形盒子.ok) return 如图形盒子;
      result.set(字符, 如图形盒子.value);
    }
  }
  return ok(result);
});

export const 如笔顺映射原子 = atom(async (get) => {
  const 如字库 = await get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 字库 = 如字库.value;
  const result = new Map<string, string>();
  for (const [字符, { glyph }] of Object.entries(字库._get())) {
    if (result.has(字符)) continue;
    if (glyph.type === "basic_component") {
      const 笔顺 = glyph.strokes.map((x) => 默认分类器[x.feature]).join("");
      result.set(字符, 笔顺);
    } else {
      const 如笔顺 = 字库.递归渲染笔画序列(glyph, result);
      if (!如笔顺.ok) return 如笔顺;
      result.set(字符, 如笔顺.value);
    }
  }
  return ok(result);
});

export const 如排序字库数据原子 = atom(async (get) => {
  const 如字库 = await get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 如笔顺映射 = await get(如笔顺映射原子);
  if (!如笔顺映射.ok) return 如笔顺映射;
  const 笔顺映射 = 如笔顺映射.value;
  const result = sortBy(
    Object.entries(如字库.value._get()),
    ([char]) => 笔顺映射.get(char)?.length ?? 0,
    // ([char]) => 笔顺映射.get(char) ?? "",
  );
  return ok(Object.fromEntries(result));
});

export const 全部标签原子 = atom(async (get) => {
  const 原始字库 = await get(原始字库原子);
  const 标签数量映射 = new Map<string, number>();
  for (const { glyphs } of Object.values(原始字库._get())) {
    for (const { tags } of glyphs) {
      tags?.map((s) => 标签数量映射.set(s, (标签数量映射.get(s) ?? 0) + 1));
    }
  }
  return [...标签数量映射].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
});

export const 下一个可用的码位原子 = atom((get) => {
  const 用户原始字库数据 = get(用户原始字库数据原子);
  const codes = new Set(
    Object.keys(用户原始字库数据).map((x) => x.codePointAt(0)!),
  );
  for (let i = 0xf000; i <= 0xf8ff; ++i) {
    if (!codes.has(i)) return i;
  }
  return 0xffff;
});

export const 当前元素原子 = atom<string | undefined>(undefined);

export const 平铺决策原子 = atom((get) => {
  const 决策 = get(决策原子);
  return 展开决策(决策);
});

export interface 首码分组 {
  名称: string;
  安排: string | 码位[];
}

export const 按首码分组决策原子 = atom((get) => {
  const 决策 = get(决策原子);
  const 平铺决策 = get(平铺决策原子);
  if (!平铺决策.ok) return 平铺决策;
  const 分组决策 = new Map<string, 首码分组[]>();
  for (const [名称, 安排] of Object.entries(决策)) {
    if (!是归并(安排)) {
      const 首码 = 平铺决策.value.get(名称)?.[0];
      if (首码 === undefined) return default_err(`无法找到名称 ${名称} 的首码`);
      const 列表 = 分组决策.get(首码) ?? [];
      列表.push({ 名称, 安排 });
      分组决策.set(首码, 列表);
    }
  }
  return ok(分组决策);
});

export const 拼写运算查找表原子 = atom((get) => {
  const 拼写运算自定义 = get(拼写运算自定义原子);
  return 合并拼写运算(拼写运算自定义);
});

export const 拼音元素枚举映射原子 = atom(async (get) => {
  const 词典 = await get(词典原子);
  const 音节集合 = new Set<string>();
  for (const { 拼音 } of Object.values(词典)) {
    拼音.map((p) => 音节集合.add(p));
  }
  const 拼写运算查找表 = get(拼写运算查找表原子);
  const content: Map<string, string[]> = new Map();
  for (const [类别, 拼写运算] of 拼写运算查找表) {
    const 元素集合 = new Set<string>();
    for (const s of 音节集合) {
      const res = 默认拼音分析器.应用拼写运算(类别, 拼写运算, s);
      元素集合.add(res);
    }
    content.set(类别, [...元素集合].sort());
  }
  return content;
});

export const 字形分析配置原子 = atom((get) => {
  const 分析配置 = get(分析配置原子);
  const 决策 = get(决策原子);
  const 决策空间 = get(决策空间原子);
  return { 分析配置, 决策, 决策空间 };
});

export const 如字形分析结果原子 = atom(async (get) => {
  const 如字库 = await get(如字库原子);
  if (!如字库.ok) return 如字库;
  const 字形分析配置 = get(字形分析配置原子);
  const 汉字集合 = await get(汉字集合原子);
  const result = await thread.spawn<Result<字形分析结果, Error>>("analysis", [
    如字库.value._get(),
    字形分析配置,
    汉字集合,
  ]);
  return result;
});

export const 拼音分析结果原子 = atom(async (get) => {
  const 编码配置 = get(编码配置原子);
  const 拼写运算查找表 = get(拼写运算查找表原子);
  const 词典 = await get(词典原子);
  return 分析拼音(编码配置, 拼写运算查找表, 词典);
});

export const 如组装结果原子 = atom(async (get) => {
  const 拼音分析结果 = await get(拼音分析结果原子);
  const 如字形分析结果 = await get(如字形分析结果原子);
  if (!如字形分析结果.ok) return 如字形分析结果;
  const 字形分析结果 = 如字形分析结果.value;
  const 编码配置 = get(编码配置原子);
  const 键盘配置 = get(键盘原子);
  const 自定义元素映射 = get(自定义元素映射原子);
  const config = {
    编码配置: 编码配置,
    键盘配置: 键盘配置,
    自定义分析映射: 自定义元素映射,
  };
  const result = await thread.spawn<组装条目[]>("assembly", [
    config,
    拼音分析结果,
    字形分析结果,
  ]);
  return ok(result);
});

export const 优先简码映射原子 = atom((get) => {
  const 优先简码列表 = get(优先简码原子);
  const map = new Map<string, number>();
  for (const { 词, 拼音来源列表, 级别 } of 优先简码列表) {
    const hash = 识别符(词, 拼音来源列表);
    map.set(hash, 级别);
  }
  return map;
});

export const 如组装结果与优先简码原子 = atom(async (get) => {
  const 如组装结果 = await get(如组装结果原子);
  if (!如组装结果.ok) return 如组装结果;
  const 优先简码映射 = get(优先简码映射原子);
  const result = 如组装结果.value.map((x) => {
    const hash = 识别符(x.词, x.拼音来源列表);
    const 简码长度 = 优先简码映射.get(hash);
    const value: 组装条目 & { 简码长度?: number } = { ...x };
    if (简码长度 !== undefined) {
      value.简码长度 = 简码长度;
    }
    return value;
  });
  return ok(result);
});

export const 如前端输入原子 = atom(async (get) => {
  const 配置 = get(配置原子);
  const 词列表 = await get(如组装结果与优先简码原子);
  if (!词列表.ok) return 词列表;

  return ok({
    配置,
    词列表: 词列表.value.map((x) => ({
      ...x,
      元素序列: 总序列化(x.元素序列),
    })),
    原始键位分布信息:
      get(用户键位分布原子) ?? (await get(默认键位分布目标原子)),
    原始当量信息: get(用户双键当量原子) ?? (await get(默认当量原子)),
  });
});

export const 如编码结果原子 = atom(async (get) => {
  const 默认目标 = get(默认目标原子);
  const 如前端输入 = await get(如前端输入原子);
  if (!如前端输入.ok) return 如前端输入;
  const result = await thread.spawn<[编码结果, Metric]>("encode", [
    如前端输入.value,
    默认目标,
  ]);
  return ok(result);
});

export interface 联合条目 extends 组装条目, 编码条目 {}

export const 联合结果原子 = atom(async (get) => {
  const 如组装结果 = await get(如组装结果原子);
  if (!如组装结果.ok) return 如组装结果;
  const 如编码结果 = await get(如编码结果原子);
  if (!如编码结果.ok) return 如编码结果;
  const [编码结果] = 如编码结果.value;
  const combined: 联合条目[] = 如组装结果.value.map((x, i) => ({
    ...x,
    ...编码结果[i]!,
  }));
  return ok(combined);
});
