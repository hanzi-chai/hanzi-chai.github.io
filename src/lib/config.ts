import type { Classifier, Feature } from "./classifier";
import type { Form, Repertoire } from "./data";
import type { CodableObject } from "./element";
import type { Example } from "./example";

type SieveName =
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

type Selector = SieveName[];

type PartialClassifier = Partial<Record<Feature, number>>;

type Mapping = Record<string, string>;
// 这个暂时没有启用
type Grouping = Record<string, string | [string, number]>;

interface BaseConfig {
  alphabet: string;
  mapping_type?: number;
  mapping: Mapping;
  grouping: Mapping;
}

interface Degenerator {
  feature?: Partial<Record<Feature, Feature>>;
  no_cross?: boolean;
}

interface FormConfig extends BaseConfig {
  analysis?: {
    degenerator?: Degenerator;
    selector?: Selector;
    customize?: Record<string, string[]>;
    strong?: string[];
    weak?: string[];
  };
}

interface Source {
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

type Condition = UnaryCondition | BinaryCondition;

type WordRule = { formula: string } & (
  | { length_equal: number }
  | { length_in_range: number[] }
);

interface Config {
  version?: string;
  // 有值表示它是从示例创建的，无值表示它是从模板创建的
  source: Example | null;
  info?: {
    name?: string;
    author?: string;
    version?: string;
    description?: string;
  };
  data?: {
    form?: Form;
    repertoire?: Repertoire;
    classifier?: PartialClassifier;
  };
  form: FormConfig;
  encoder: {
    max_length?: number;
    auto_select_length?: number;
    rules?: WordRule[];
    sources: Record<string, Source>;
    conditions: Record<string, Condition>;
  };
}

type MergedData = {
  form: Form;
  repertoire: Repertoire;
  classifier: Classifier;
};

type ExampleConfig = Required<Config>;

export type {
  Degenerator,
  SieveName,
  Selector,
  PartialClassifier,
  Mapping,
  Grouping,
  Config,
  MergedData,
  ExampleConfig,
  FormConfig,
  Source,
  Condition,
};
