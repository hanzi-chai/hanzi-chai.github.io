export * from "./main.js";

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import Pako from "pako";
import { 组装, type 组装配置 } from "./assembly.js";
import type { 配置 } from "./config.js";
import type { 原始字库数据 } from "./data.js";
import { 分析拼音, 合并拼写运算, type 拼音分析结果 } from "./pinyin.js";
import { 原始字库 } from "./primitive.js";
import type { 字库, 字形分析结果 } from "./repertoire.js";
import {
  ok,
  type Result,
  type 自定义分析映射,
  获取汉字集合,
  解析当量映射,
  解析词典,
  解析键位分布目标,
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

export function 获取原始字库(自定义字库: 原始字库数据 = {}): 原始字库 {
  const 路径 = path.join(__dirname, "data", "repertoire.json.deflate");
  const 内容 = Pako.inflate(readFileSync(路径), { to: "string" });
  const 原始字库数据: 原始字库数据 = JSON.parse(内容);
  return new 原始字库({ ...原始字库数据, ...自定义字库 });
}

export function 获取词典(路径?: string): 词典 {
  const 默认路径 = path.join(__dirname, "data", "dictionary.txt");
  const tsv = 读取表格(readFileSync(路径 ?? 默认路径, "utf-8"));
  return 解析词典(tsv);
}

export function 获取键位分布目标(路径?: string): 键位分布目标 {
  const 默认路径 = path.join(__dirname, "data", "key_distribution.txt");
  const 内容 = readFileSync(路径 ?? 默认路径, "utf-8");
  const tsv = 读取表格(内容);
  return 解析键位分布目标(tsv);
}

export function 获取当量映射(路径?: string) {
  const 默认路径 = path.join(__dirname, "data", "pair_equivalence.txt");
  const 内容 = readFileSync(路径 ?? 默认路径, "utf-8");
  const tsv = 读取表格(内容);
  return 解析当量映射(tsv);
}

export function 获取自定义元素映射(自定义元素文件集合: Record<string, string>) {
  const 查找表: 自定义分析映射 = new Map();
  for (const [名称, 文件路径] of Object.entries(自定义元素文件集合)) {
    const tsv = 读取表格(readFileSync(文件路径, "utf-8"));
    for (const [char, elements] of tsv) {
      if (char === undefined || elements === undefined) continue;
      const 记录 = 查找表.get(char) ?? {};
      记录[名称] = elements.split(" ");
      查找表.set(char, 记录);
    }
  }
  return 查找表;
}

export function 获取字库(config: 配置): Result<字库, Error> {
  const 用户原始字库数据 = config.data?.repertoire ?? {};
  const 原始字库 = 获取原始字库(用户原始字库数据);
  const 自定义字形 = config.data?.glyph_customization ?? {};
  const 标签列表 = config.data?.tags ?? [];
  const 字库或错误 = 原始字库.确定(自定义字形, 标签列表);
  if (!字库或错误.ok) {
    return 字库或错误;
  }
  let 字库 = 字库或错误.value;
  const 变换器列表 = config.data?.transformers ?? [];
  for (const 变换器 of 变换器列表) {
    字库 = 字库.应用变换器(变换器);
  }
  return ok(字库);
}

export function 获取字形分析结果(config: 配置, repertoire: 字库, 词典: 词典) {
  const 字形分析配置 = {
    分析配置: config.analysis ?? {},
    决策: config.form.mapping,
    决策空间: config.form.mapping_space ?? {},
  };
  const characters = 获取汉字集合(词典);
  return repertoire.拆分(字形分析配置, characters);
}

export function 获取拼音分析结果(config: 配置, 词典: 词典) {
  const 编码配置 = config.encoder ?? {};
  const 拼写运算查找表 = 合并拼写运算(config.algebra);
  return 分析拼音(编码配置, 拼写运算查找表, 词典);
}

export function 获取组装结果(
  config: 配置,
  拼音分析结果: 拼音分析结果,
  字形分析结果: 字形分析结果,
  自定义分析结果: 自定义分析映射 = new Map(),
) {
  const assembleConfig: Omit<组装配置, "额外信息"> = {
    编码配置: config.encoder ?? {},
    键盘配置: config.form,
    自定义分析映射: 自定义分析结果,
  };
  const res = 组装(assembleConfig, 拼音分析结果, 字形分析结果);
  return res;
}
