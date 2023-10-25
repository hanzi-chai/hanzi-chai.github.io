import { Form, Repertoire } from "./data";
import { CodableObject } from "./element";

type SieveName = "根少优先" | "笔顺优先" | "能连不交" | "能散不连" | "取大优先";

type Selector = SieveName[];

type Classifier = Record<string, number>;

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
  };
}

interface PronunciationConfig extends BaseConfig {}

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
  source?: string;
  info: {
    name: string;
    author: string;
    version: string;
    description: string;
  };
  data: {
    form: Form;
    repertoire: Repertoire;
    classifier: Classifier;
  };
  form: FormConfig;
  pronunciation: PronunciationConfig;
  encoder: {
    sources: Record<string, Source>;
    conditions: Record<string, Condition>;
  };
}

export type {
  SieveName,
  Selector,
  Classifier,
  Mapping,
  Config,
  FormConfig,
  PronunciationConfig,
  Source,
  Condition,
};
