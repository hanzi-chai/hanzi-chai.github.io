export * from "./main.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Pako from "pako";
import type { 原始汉字数据, 原始字库数据 } from "./data.js";
import {
  type 词典,
  type 频率映射,
  listToObject,
  解析词典,
  解析频率映射,
  读取表格,
} from "./utils.js";
import type { 配置 } from "./config.js";
import 原始字库 from "./primitive.js";
import 字库 from "./repertoire.js";
import { assemble, type 组装配置 } from "./assembly.js";
import { load } from "js-yaml";

export interface Item {
  id: number;
  name: string;
  price: number;
}

// ESM 中模拟 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Model {
  unicode: number;
  tygf: 0 | 1 | 2 | 3;
  gb2312: 0 | 1 | 2;
  readings: string;
  glyphs: string;
  name: string | null;
  gf0014_id: number | null;
  gf3001_id: number | null;
  ambiguous: 0 | 1;
}

const codeToChar = (code: number) => String.fromCodePoint(code);

const glyphForward = (c: any) => {
  if (c.type === "basic_component") {
    return c;
  } else if (c.type === "derived_component" || c.type === "identity") {
    return { ...c, source: codeToChar(c.source) };
  } else {
    return { ...c, operandList: c.operandList.map(codeToChar) };
  }
};

export function fromModel(model: Model): 原始汉字数据 {
  return {
    ...model,
    readings: JSON.parse(model.readings),
    glyphs: JSON.parse(model.glyphs).map(glyphForward),
    ambiguous: model.ambiguous === 1,
  };
}

export function 读取配置(路径: string): 配置 {
  const 内容 = readFileSync(路径, "utf-8");
  return load(内容) as 配置;
}

export function 获取原始字库(自定义字库: 原始字库数据 = {}): 原始字库 {
  const 路径 = path.join(__dirname, "data", "repertoire.json.deflate");
  const 内容 = Pako.inflate(readFileSync(路径), { to: "string" });
  const raw = JSON.parse(内容).map(fromModel) as 原始汉字数据[];
  const 原始字库数据 = listToObject(raw);
  return new 原始字库(原始字库数据, 自定义字库);
}

export function 获取词典(): 词典 {
  const 路径 = path.join(__dirname, "data", "dictionary.txt");
  const tsv = 读取表格(readFileSync(路径, "utf-8"));
  return 解析词典(tsv);
}

export function 获取频率映射(): 频率映射 {
  const 路径 = path.join(__dirname, "data", "frequency.txt");
  const tsv = 读取表格(readFileSync(路径, "utf-8"));
  return 解析频率映射(tsv);
}

export function 获取字库(config: 配置): 字库 {
  const 用户原始字库数据 = config.data?.repertoire ?? {};
  const 原始字库 = 获取原始字库(用户原始字库数据);
  const 自定义字形 = config.data?.glyph_customization ?? {};
  const 自定义字音 = config.data?.reading_customization ?? {};
  const 标签列表 = config.data?.tags ?? [];
  const 字库或错误 = 原始字库.确定(自定义字形, 自定义字音, 标签列表);
  if (!字库或错误.ok) {
    throw new Error(`字库确定失败: ${字库或错误.error}`);
  }
  let 字库 = 字库或错误.value;
  const transformers = config.data?.transformers ?? [];
  for (const transformer of transformers) {
    字库 = 字库.应用变换器(transformer);
  }
  return 字库;
}

export function 获取拆分结果(config: 配置, repertoire: 字库) {
  const analysisConfig = repertoire.准备字形分析配置(
    config.analysis ?? {},
    config.form.mapping,
    config.form.mapping_space ?? {},
  );
  if (!analysisConfig.ok) {
    throw new Error(`字形分析配置无效: ${analysisConfig.error}`);
  }
  const characters = repertoire.过滤(config.data?.character_set ?? "general");
  return repertoire.拆分(analysisConfig.value, characters);
}

export function 获取组装结果(config: 配置, repertoire: 字库) {
  const analysisResult = 获取拆分结果(config, repertoire);
  if (!analysisResult.ok) {
    throw new Error(`字形分析失败: ${analysisResult.error}`);
  }
  const characters = repertoire.过滤(config.data?.character_set ?? "general");
  const pinyinResult = repertoire.拼音分析(
    config.encoder ?? {},
    config.algebra,
    characters,
    获取词典(),
  );
  const assembleConfig: 组装配置 = {
    编码器: config.encoder ?? {},
    键盘: config.form,
    自定义元素映射: new Map(),
    额外信息: { 字根笔画映射: new Map() },
  };
  const res = assemble(
    assembleConfig,
    pinyinResult,
    analysisResult.value,
    获取频率映射(),
  );
  return res;
}
