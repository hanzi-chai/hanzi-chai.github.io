export * from "./main.js";

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import Pako from "pako";
import { 组装, type 组装配置 } from "./assembly.js";
import { 合并分类器 } from "./classifier.js";
import type { 配置 } from "./config.js";
import type { 原始汉字数据 } from "./data.js";
import {
  分析拼音,
  合并拼写运算,
  type 拼音分析映射,
  type 拼音分析结果,
} from "./pinyin.js";
import { 原始字库 } from "./primitive.js";
import type { 字库, 字形分析结果 } from "./repertoire.js";
import {
  ok,
  type Result,
  type 原始词典,
  type 强类型决策,
  type 强类型决策空间,
  构建强类型决策与决策空间,
  标准化自定义,
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

export function 获取原始字库(自定义字库: 原始汉字数据[] = []): 原始字库 {
  const 路径 = path.join(__dirname, "data", "repertoire.json.deflate");
  const 内容 = Pako.inflate(readFileSync(路径), { to: "string" });
  const 原始字库数据: 原始汉字数据[] = JSON.parse(内容);
  return new 原始字库([...原始字库数据, ...自定义字库]);
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

export function 获取字库(配置: 配置): Result<字库, Error> {
  const 用户原始字库数据 = 配置.data?.repertoire ?? {};
  const 原始字库 = 获取原始字库(Object.values(用户原始字库数据));
  const 自定义字形 = 配置.data?.glyph_customization ?? {};
  const 变换器列表 = 配置.data?.transformers ?? [];
  const 字形来源列表 = (配置.data?.glyph_sources ?? []) as 源标签[];
  const 字库或错误 = 原始字库.确定(
    标准化自定义(自定义字形),
    变换器列表,
    字形来源列表,
  );
  if (!字库或错误.ok) {
    return 字库或错误;
  }
  return ok(字库或错误.value);
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
  const 字符列表 = [...字库].map(({ 字符 }) => 字符);
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
  原始字库: 原始字库,
) {
  const { 决策, 决策空间 } = 获取决策与决策空间(配置, 字库, 词典, 原始字库);
  const 字形分析配置 = {
    决策,
    决策空间,
    分析配置: 配置.analysis ?? {},
    字形来源列表: 配置.data?.glyph_sources ?? [],
  };
  const 汉字集合 = 原始字库.获取汉字集合(词典);
  return 字库.分析(字形分析配置, 汉字集合, 原始字库);
}

export function 获取拼音分析结果(拼音分析映射: 拼音分析映射, 词典: 词典) {
  return 分析拼音(拼音分析映射, 词典);
}

export function 获取组装结果(
  配置: 配置,
  决策: 强类型决策,
  决策空间: 强类型决策空间,
  拼音分析结果: 拼音分析结果,
  字形分析结果: 字形分析结果,
  自定义分析结果: 自定义分析映射 = new Map(),
) {
  const 组装配置: 组装配置 = {
    决策,
    决策空间,
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
