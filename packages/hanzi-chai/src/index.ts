export * from "./main.js";

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import Pako from "pako";
import { 组装, type 组装配置 } from "./assembly.js";
import { 合并分类器 } from "./classifier.js";
import type { 配置 } from "./config.js";
import type { 基本字形数据, 字符数据 } from "./data.js";
import type { 元素 } from "./element.js";
import {
  分析拼音,
  合并拼写运算,
  type 拼音分析映射,
  type 拼音分析结果,
} from "./pinyin.js";
import { 原始字库 } from "./primitive.js";
import type { 字库, 字形分析结果 } from "./repertoire.js";
import {
  决策图,
  type 原始词典,
  type 强类型决策,
  type 强类型决策空间,
  构建强类型决策与决策空间,
  构建强类型自定义分析,
  type 源标签,
  type 自定义分析,
  type 自定义分析映射,
  解析原始词典,
  解析当量映射,
  解析笔画数据,
  解析键位分布目标,
  计算全部合法元素与元素映射,
  计算拼音分析与元素映射,
  type 词典,
  读取表格,
  type 键位分布目标,
} from "./utils.js";

// ESM 中模拟 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function 读取配置(路径: string): 配置 {
  const 内容 = readFileSync(路径, "utf-8");
  return load(内容) as 配置;
}

// 辅助函数：从数据文件读取并解析
function 读取数据文件<T>(
  文件名: string,
  解析函数: (tsv: string[][]) => T,
  自定义路径?: string,
): T {
  const 默认路径 = path.join(__dirname, "data", 文件名);
  const 内容 = readFileSync(自定义路径 ?? 默认路径, "utf-8");
  const tsv = 读取表格(内容);
  return 解析函数(tsv);
}

export function 获取原始字库(
  自定义字符列表: 字符数据[] = [],
  自定义字形列表: 基本字形数据[] = [],
): 原始字库 {
  const 字符列表路径 = path.join(__dirname, "data", "characters.json.deflate");
  const 字符列表内容 = Pako.inflate(readFileSync(字符列表路径), {
    to: "string",
  });
  const 字形列表路径 = path.join(__dirname, "data", "glyphs.json.deflate");
  const 字形列表内容 = Pako.inflate(readFileSync(字形列表路径), {
    to: "string",
  });
  const 字符列表: 字符数据[] = JSON.parse(字符列表内容);
  const 字形列表: 基本字形数据[] = JSON.parse(字形列表内容);
  return new 原始字库(
    [...字符列表, ...自定义字符列表],
    [...字形列表, ...自定义字形列表],
  );
}

export function 获取原始词典(路径: string | undefined): 原始词典 {
  return 读取数据文件("dictionary.txt", 解析原始词典, 路径);
}

export function 获取键位分布目标(路径?: string): 键位分布目标 {
  return 读取数据文件("distribution.txt", 解析键位分布目标, 路径);
}

export function 获取当量映射(路径?: string) {
  return 读取数据文件("equivalence.txt", 解析当量映射, 路径);
}

export function 获取通用规范汉字笔画数据(路径?: string) {
  return 读取数据文件("tygf.txt", 解析笔画数据, 路径);
}

export function 获取CJK汉字笔画数据(路径?: string) {
  return 读取数据文件("cjk.txt", 解析笔画数据, 路径);
}

export function 获取自定义分析与元素映射(
  自定义元素文件集合: Record<string, string>,
  原始字库: 原始字库,
) {
  const 自定义元素集合: Record<string, 自定义分析> = {};
  for (const [名称, 文件路径] of Object.entries(自定义元素文件集合)) {
    const tsv = 读取表格(readFileSync(文件路径, "utf-8"));
    const 查找表: Record<string, string[]> = {};
    for (const [char, elements] of tsv) {
      if (char === undefined || elements === undefined) continue;
      查找表[char] = elements.split(" ");
    }
    自定义元素集合[名称] = 查找表;
  }
  return 原始字库.校验自定义映射(自定义元素集合);
}

export function 获取拼音分析与元素映射(config: 配置, 词典: 词典) {
  const 拼写运算查找表 = 合并拼写运算(config.algebra);
  return 计算拼音分析与元素映射(词典, 拼写运算查找表);
}

export function 获取字库(配置: 配置) {
  const 自定义字符列表 = 配置.data?.characters ?? [];
  const 自定义字形列表 = 配置.data?.glyphs ?? [];
  const 原始字库 = 获取原始字库(自定义字符列表, 自定义字形列表);
  const 字形自定义 = 配置.data?.character_customization ?? {};
  const 拼写运算列表 = 配置.data?.glyph_algebra ?? [];
  const 字形来源列表 = (配置.data?.glyph_sources ?? []) as 源标签[];
  return 原始字库.确定(字形自定义, 拼写运算列表, 字形来源列表);
}

export function 获取决策与决策空间(
  配置: 配置,
  字库: 字库,
  词典: 词典,
  原始字库: 原始字库,
) {
  const 分类器 = 合并分类器(配置.analysis?.classifier);
  const { 拼音元素映射 } = 获取拼音分析与元素映射(配置, 词典);
  const { 自定义元素映射 } = 获取自定义分析与元素映射({}, 原始字库);
  const 字符列表 = [...字库].map(([字符]) => 字符);
  const { 名称映射 } = 计算全部合法元素与元素映射(
    字符列表,
    分类器,
    拼音元素映射,
    自定义元素映射,
  );
  return 构建强类型决策与决策空间(
    配置.form.mapping,
    配置.form.mapping_space ?? {},
    名称映射,
  );
}

export function 获取字形分析结果(
  配置: 配置,
  字库: 字库,
  词典: 词典,
  名称映射: Map<string, 元素>,
  原始字库: 原始字库,
) {
  const { 决策, 决策空间 } = 获取决策与决策空间(配置, 字库, 词典, 原始字库);
  const 如线性化决策 = new 决策图(决策).线性化();
  if (!如线性化决策.ok) throw 如线性化决策.error;
  const 线性化决策 = 如线性化决策.value;
  const { 自定义分析映射, 动态自定义分析映射 } = 构建强类型自定义分析(
    字库,
    原始字库,
    名称映射,
    配置.analysis?.customize ?? {},
    配置.analysis?.dynamic_customize ?? {},
  );
  const 字形分析配置 = {
    决策,
    决策空间,
    自定义分析映射,
    动态自定义分析映射,
    分析配置: 配置.analysis ?? {},
    字形来源列表: 配置.data?.glyph_sources ?? [],
    线性化决策,
  };
  const 汉字集合 = 原始字库.获取汉字集合(词典);
  return 字库.分析(字形分析配置, 汉字集合);
}

export function 获取拼音分析结果(拼音分析映射: 拼音分析映射, 词典: 词典) {
  return 分析拼音(拼音分析映射, 词典);
}

export function 获取组装结果(
  配置: 配置,
  决策: 强类型决策,
  决策空间: 强类型决策空间,
  线性化决策: Map<元素, string>,
  拼音分析结果: 拼音分析结果,
  字形分析结果: 字形分析结果,
  自定义分析结果: 自定义分析映射 = new Map(),
) {
  const 组装配置: 组装配置 = {
    决策,
    决策空间,
    线性化决策,
    最大码长: 配置.encoder.max_length,
    源映射: 配置.encoder.sources,
    条件映射: 配置.encoder.conditions,
    构词规则列表: 配置.encoder.rules ?? [],
    组装器: 配置.encoder.assembler,
    键盘配置: 配置.form,
    自定义分析映射: 自定义分析结果,
    分类器: 合并分类器(配置.analysis?.classifier),
  };
  const res = 组装(组装配置, 拼音分析结果, 字形分析结果);
  return res;
}
