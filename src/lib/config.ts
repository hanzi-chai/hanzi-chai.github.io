import type { Classifier, Feature } from "./classifier";
import type { Form, Repertoire } from "./data";
import type { CodableObject } from "./element";
import type { Example } from "./example";

type SieveName = "根少优先" | "笔顺优先" | "能连不交" | "能散不连" | "取大优先";

type Selector = SieveName[];

type PartialClassifier = Partial<Record<Feature, number>>;

type Mapping = Record<string, string>;

interface BaseConfig {
  alphabet: string;
  maxcodelen: number;
  grouping: Mapping;
  mapping: Mapping;
}

interface FormConfig extends BaseConfig {
  analysis: {
    selector: Selector;
    customize: Record<string, string[]>;
  };
}

type PronunciationConfig = BaseConfig;

interface Source {
  object?: CodableObject;
  index?: number;
  next: string | null;
}

export const binaryOps = ["是", "不是", "匹配", "不匹配"] as const;
export const unaryOps = ["存在", "不存在"] as const;
export const ops = (unaryOps as readonly Op[]).concat(...binaryOps);
export type Op = (typeof binaryOps)[number] | (typeof unaryOps)[number];

interface Condition {
  object: CodableObject;
  operator: Op;
  value?: string;
  positive: string | null;
  negative: string | null;
}

interface Config {
  version: string;
  source?: Example;
  info: {
    name: string;
    author: string;
    version: string;
    description: string;
  };
  data: {
    form: Form;
    repertoire: Repertoire;
    classifier: PartialClassifier;
  };
  form: FormConfig;
  pronunciation: PronunciationConfig;
  encoder: {
    sources: Record<string, Source>;
    conditions: Record<string, Condition>;
  };
}

type MergedData = Config["data"] & { classifier: Classifier };

type ExampleConfig = Required<Config>;

export type {
  SieveName,
  Selector,
  PartialClassifier,
  Mapping,
  Config,
  MergedData,
  ExampleConfig,
  FormConfig,
  PronunciationConfig,
  Source,
  Condition,
};
