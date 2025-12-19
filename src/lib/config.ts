import type { Feature } from "./classifier";
import type {
  Compound,
  PrimitiveRepertoire,
  Component,
  Reading,
  Identity,
} from "./data";
import type { CodableObject } from "./element";
import type { Example } from "./templates";

// config.info begin
export interface Info {
  name?: string;
  author?: string;
  version?: string;
  description?: string;
}
// config.info end

// config.data begin

export const characterSetSpecifiers = [
  "minimal",
  "gb2312",
  "general",
  "basic",
  "extended",
  "supplement",
  "maximal",
  "custom",
] as const;
export type CharacterSetSpecifier = (typeof characterSetSpecifiers)[number];

export interface Data {
  character_set?: CharacterSetSpecifier;
  repertoire?: PrimitiveRepertoire;
  glyph_customization?: CustomGlyph;
  reading_customization?: CustomReadings;
  tags?: string[];
}

export type CustomGlyph = Record<string, Component | Compound | Identity>;
export type CustomReadings = Record<string, Reading[]>;
// config.data end

// config.analysis begin
export interface Analysis {
  classifier?: Record<Feature, number>;
  degenerator?: Degenerator;
  selector?: Selector;
  customize?: Record<string, string[]>;
  dynamic_customize?: Record<string, string[][]>;
  strong?: string[];
  weak?: string[];
  serializer?:
    | "sequential"
    | "zhangma"
    | "zhenma"
    | "snow2"
    | "xkjd"
    | "shouyou"
    | "feihua";
}

export interface Degenerator {
  feature?: Record<Feature, Feature>;
  no_cross?: boolean;
}

export type SieveName =
  | "根少优先"
  | "连续笔顺"
  | "全符笔顺"
  | "能连不交"
  | "能散不连"
  | "同向笔画"
  | "取大优先"
  | "取小优先"
  | "结构完整"
  | "多强字根"
  | "少弱字根"
  | "非形近根";

export type Selector = SieveName[];
// config.analysis end

// config.algebra begin
export type Algebra = Record<string, Rule[]>;

export type Rule = Transformation | Transliteration;

interface Transformation {
  type: "xform";
  from: string;
  to: string;
}

interface Transliteration {
  type: "xlit";
  from: string;
  to: string;
}
// config.algebra end

// config.form begin
export interface Keyboard {
  alphabet?: string;
  mapping_type?: number;
  mapping: Mapping;
  mapping_space?: MappingSpace;
  mapping_generator?: MappingGeneratorRule[];
}

export interface MappingGeneratorRule {
  name: string;
  keys: string[];
}

export type Element = string;

export type ElementWithIndex = { element: string; index: number };

export type Key = string | ElementWithIndex;

export type Value = null | string | Key[] | { element: string };

export type GeneratorKey = { generator: string };

export type GeneralizedValue =
  | null
  | string
  | (Key | GeneratorKey)[]
  | { element: string };

export function isMerge(value: GeneralizedValue): value is { element: string } {
  return typeof value === "object" && value !== null && "element" in value;
}

export type Mapping = Record<Element, Exclude<Value, null>>;

export interface ValueDescription {
  value: GeneralizedValue;
  score: number;
  condition?: { element: string; op: "是" | "不是"; value: Value }[];
}

export type MappingSpace = Record<Element, ValueDescription[]>;
// config.form end

// config.encoder begin
export interface EncoderConfig {
  max_length: number;
  select_keys?: string[];
  auto_select_length?: number;
  auto_select_pattern?: string;
  // 一字词全码
  sources: Record<string, Source>;
  conditions: Record<string, Condition>;
  // 多字词全码
  rules?: WordRule[];
  // 简码
  short_code?: ShortCodeRule[];
  priority_short_codes?: [string, string, number][];
}

export interface Source {
  // 起始节点不应该有一个可编码对象，所以是 null；其他情况都有值
  object: CodableObject | null;
  // 如果只取其中几码就有值，否则为 undefined
  index?: number;
  // next 是对下个节点的引用，所以是 null
  next: string | null;
}

export const binaryOps = [
  "是",
  "不是",
  "匹配",
  "不匹配",
  "编码匹配",
  "编码不匹配",
] as const;
export const unaryOps = ["存在", "不存在"] as const;
export const ops = (unaryOps as readonly Op[]).concat(...binaryOps);
export type UnaryOp = (typeof unaryOps)[number];
export type BinaryOp = (typeof binaryOps)[number];
export type Op = UnaryOp | BinaryOp;

export interface UnaryCondition {
  object: CodableObject;
  operator: UnaryOp;
  positive: string | null;
  negative: string | null;
}

export interface BinaryCondition {
  object: CodableObject;
  operator: BinaryOp;
  value: string;
  positive: string | null;
  negative: string | null;
}

export type Condition = UnaryCondition | BinaryCondition;

type LengthSpecifier =
  | { length_equal: number }
  | { length_in_range: [number, number] };

export const wordLengthArray = [...Array(9).keys()].map((x) => ({
  label: x + 1,
  value: x + 1,
}));

export type WordRule = { formula: string } & LengthSpecifier;

export type ShortCodeRule = { schemes: ShortCodeScheme[] } & LengthSpecifier;

export interface ShortCodeScheme {
  prefix: number;
  count?: number;
  select_keys?: string[];
}
// config.encoder end

// config.optimization begin
export interface LevelWeights {
  length: number;
  frequency: number;
}

export type FingeringWeights = (number | null)[];

export interface TierWeights {
  top?: number;
  duplication?: number;
  levels?: LevelWeights[];
  fingering?: FingeringWeights;
}

export const fingeringLabels = [
  "同手",
  "大跨",
  "小跨",
  "干扰",
  "错手",
  "三连",
  "备用",
  "备用",
];

export interface PartialWeights {
  tiers?: TierWeights[];
  duplication?: number;
  key_distribution?: number;
  pair_equivalence?: number;
  extended_pair_equivalence?: number;
  fingering?: FingeringWeights;
  levels?: LevelWeights[];
}

interface ElementAffinityTarget {
  element: ElementWithIndex;
  affinity: number;
}

interface KeyAffinityTarget {
  key: string;
  affinity: number;
}

interface AffinityList<T> {
  from: ElementWithIndex;
  to: T[];
}

export interface Regularization {
  strength?: number; // default 1e-2
  element_affinities?: AffinityList<ElementAffinityTarget>[];
  key_affinities?: AffinityList<KeyAffinityTarget>[];
}

export interface Objective {
  characters_full?: PartialWeights;
  characters_short?: PartialWeights;
  words_full?: PartialWeights;
  words_short?: PartialWeights;
  regularization?: Regularization;
}

export type PartialWeightTypes = Exclude<keyof Objective, "regularization">;

export interface Optimization {
  objective: Objective;
  metaheuristic: Solver;
}

export const defaultOptimization: Optimization = {
  objective: {},
  metaheuristic: {
    algorithm: "SimulatedAnnealing",
  },
};

export interface Solver {
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

export type BoxConfig = {
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

export interface DiagramConfig {
  layout: {
    keys: string[];
  }[];
  contents: BoxConfig[];
  row_style?: string;
  cell_style?: string;
}

// config.diagram end

export interface Config {
  version?: string;
  // 有值表示它是从示例创建的，无值表示它是从模板创建的
  source: Example | null;
  info?: Info;
  data?: Data;
  analysis?: Analysis;
  algebra?: Algebra;
  form: Keyboard;
  encoder: EncoderConfig;
  optimization?: Optimization;
  diagram?: DiagramConfig;
}

export type ExampleConfig = Required<Config>;
