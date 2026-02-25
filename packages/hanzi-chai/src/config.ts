import type { 笔画名称 } from "./classifier.js";
import type { 原始字库数据, 字形数据, 结构表示符 } from "./data.js";
import type { 取码对象 } from "./element.js";

// config.info begin
export interface 基本信息 {
  name?: string;
  author?: string;
  version?: string;
  description?: string;
}
// config.info end

// config.data begin

export const 字集指示列表 = [
  "minimal",
  "gb2312",
  "general",
  "basic",
  "extended",
  "supplement",
  "maximal",
] as const;
export type 字集指示 = (typeof 字集指示列表)[number];

export interface 数据配置 {
  character_set?: 字集指示;
  repertoire?: 原始字库数据;
  glyph_customization?: 兼容字形自定义;
  transformers?: 变换器[];
  glyph_sources?: string[];
}

export type 兼容字形自定义 = Record<string, 字形数据 | 字形数据[]>;

export type 字形自定义 = Record<string, 字形数据[]>;

export interface 变换器 {
  from: 模式;
  to: 模式;
}

export interface 模式 {
  operator: 结构表示符;
  operandList: 节点[];
}

export type 节点 = 模式 | 结构变量 | string;

export interface 结构变量 {
  id: number;
}

// config.data end

// config.analysis begin
export interface 分析配置 {
  classifier?: Record<笔画名称, number>;
  degenerator?: 退化配置;
  selector?: string[];
  customize?: Record<string, string[]>;
  dynamic_customize?: Record<string, string[][]>;
  strong?: string[];
  weak?: string[];
  component_analyzer?: string;
  compound_analyzer?: string;
  dynamic?: boolean;
}

export interface 退化配置 {
  feature?: Record<笔画名称, 笔画名称>;
  no_cross?: boolean;
}
// config.analysis end

// config.algebra begin
export type 拼写运算 = 运算规则[];

export type 运算规则 = 变换 | 转写;

interface 变换 {
  type: "xform";
  from: string;
  to: string;
}

interface 转写 {
  type: "xlit";
  from: string;
  to: string;
}
// config.algebra end

// config.form begin
export interface 键盘配置 {
  alphabet?: string;
  mapping_type?: number;
  mapping: 决策;
  mapping_space?: 决策空间;
  mapping_variables?: Record<string, 变量规则>;
  mapping_generators?: 决策生成器规则[];
  // Deprecated, use mapping instead
  grouping?: Record<string, string>;
}

export interface 变量规则 {
  keys: string[];
}

export interface 决策生成器规则 {
  regex: string;
  value: 安排描述;
}

export type 元素 = string;

export type 元素位 = { element: string; index: number };

export type 码位 = string | 元素位;

export type 安排 = null | string | 码位[] | { element: string };

export type 非空安排 = Exclude<安排, null>;

export type 变量安排 = { variable: string };

export type 广义码位 = 码位 | 变量安排 | null;

export function 是变量(key: 广义码位): key is 变量安排 {
  return typeof key === "object" && key !== null && "variable" in key;
}

export type 广义安排 = null | string | 广义码位[] | { element: string };

export type 非空广义安排 = Exclude<广义安排, null>;

export function 是归并(value: 广义安排): value is { element: string } {
  return typeof value === "object" && value !== null && "element" in value;
}

export type 决策 = Record<元素, 非空安排>;

export interface 安排描述 {
  value: 广义安排;
  score: number;
  condition?: { element: string; op: "是" | "不是"; value: 安排 }[];
}

export type 决策空间 = Record<元素, 安排描述[]>;
// config.form end

// config.encoder begin

export interface 优先简码 {
  word: string;
  sources: string[][];
  level: number;
}

export interface 编码配置 {
  max_length: number;
  select_keys?: string[];
  auto_select_length?: number;
  auto_select_pattern?: string;
  // 一字词全码
  sources: Record<string, 源节点配置>;
  conditions: Record<string, 条件节点配置>;
  // 多字词全码
  rules?: 构词规则[];
  // 简码
  short_code?: 简码规则[];
  short_code_list?: 优先简码[];
  // 组装器
  assembler?: string;
}

export interface 源节点配置 {
  // 起始节点不应该有一个可编码对象，所以是 null；其他情况都有值
  object: 取码对象 | null;
  // 如果只取其中几码就有值，否则为 undefined
  index?: number;
  // next 是对下个节点的引用，所以是 null
  next: string | null;
  // 节点备注
  notes?: string;
}

export const 二元运算符列表 = [
  "是",
  "不是",
  "匹配",
  "不匹配",
  "编码匹配",
  "编码不匹配",
] as const;
export const 一元运算符列表 = ["存在", "不存在"] as const;
export const 运算符列表 = (一元运算符列表 as readonly 运算符[]).concat(
  ...二元运算符列表,
);
export type 一元运算符 = (typeof 一元运算符列表)[number];
export type 二元运算符 = (typeof 二元运算符列表)[number];
export type 运算符 = 一元运算符 | 二元运算符;

export interface 一元条件配置 {
  object: 取码对象;
  operator: 一元运算符;
  positive: string | null;
  negative: string | null;
  notes?: string;
}

export interface 二元条件配置 {
  object: 取码对象;
  operator: 二元运算符;
  value: string;
  positive: string | null;
  negative: string | null;
  notes?: string;
}

export type 条件节点配置 = 一元条件配置 | 二元条件配置;

type 长度限定 =
  | { length_equal: number }
  | { length_in_range: [number, number] };

export const 多字词长度列表 = [...Array(9).keys()].map((x) => ({
  label: x + 1,
  value: x + 1,
}));

export type 构词规则 = { formula: string } & 长度限定;

export type 简码规则 = { schemes: 简码模式[] } & 长度限定;

export interface 简码模式 {
  prefix: number;
  count?: number;
  select_keys?: string[];
}
// config.encoder end

// config.optimization begin
export interface 码长权重 {
  length: number;
  frequency: number;
}

export type 指法权重 = (number | null)[];

export interface 层级权重 {
  top?: number;
  duplication?: number;
  levels?: 码长权重[];
  fingering?: 指法权重;
}

export const 指法标签列表 = [
  "同手",
  "大跨",
  "小跨",
  "干扰",
  "错手",
  "三连",
  "备用",
  "备用",
];

export interface 部分权重 {
  tiers?: 层级权重[];
  duplication?: number;
  key_distribution?: number;
  pair_equivalence?: number;
  fingering?: 指法权重;
  levels?: 码长权重[];
}

export interface 目标配置 {
  characters_full?: 部分权重;
  characters_short?: 部分权重;
  words_full?: 部分权重;
  words_short?: 部分权重;
  regularization_strength?: number;
}

export type 部分目标类型 = Exclude<keyof 目标配置, "regularization_strength">;

export interface 优化配置 {
  objective: 目标配置;
  metaheuristic: 求解器配置;
}

export const 默认优化配置: 优化配置 = {
  objective: {},
  metaheuristic: {
    algorithm: "SimulatedAnnealing",
  },
};

export interface 求解器配置 {
  algorithm: "SimulatedAnnealing";
  parameters?: {
    t_max: number;
    t_min: number;
    steps: number;
  };
  report_after?: number;
  search_method?: {
    random_move: number;
    random_swap: number;
    random_full_key_swap: number;
  };
  update_interval?: number;
}
// config.optimization end

// config.diagram begin

export type 区块配置 = {
  style?: string;
} & (
  | {
      type: "key" | "uppercase";
    }
  | {
      type: "element";
      match?: string;
    }
  | {
      type: "custom";
      mapping?: string;
    }
);

export interface 图示配置 {
  layout: {
    keys: string[];
  }[];
  contents: 区块配置[];
  row_style?: string;
  cell_style?: string;
}

// config.diagram end

export interface 配置 {
  version?: string;
  // 有值表示它是从示例创建的，无值表示它是从模板创建的
  source: string | null;
  info?: 基本信息;
  data?: 数据配置;
  analysis?: 分析配置;
  algebra?: Record<string, 拼写运算>;
  form: 键盘配置;
  encoder: 编码配置;
  optimization?: 优化配置;
  diagram?: 图示配置;
}

export type 示例配置 = Required<配置>;
