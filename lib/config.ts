import { Form, Repertoire, Slices } from "./data";
import { CodableObject } from "./element";
import { Op } from "./encoder";
import { ComponentResult, CompoundResult } from "./form";

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

type Metadata = { char: string; pinyin: string };
type ComponentTotalResult = ComponentResult & Metadata;
type CompoundTotalResult = CompoundResult & Metadata;
type TotalResult = ComponentTotalResult | CompoundTotalResult;
type TotalCache = Record<
  string,
  ComponentTotalResult[] | CompoundTotalResult[]
>;

type EncoderResult = Record<string, string[]>;

interface Source {
  object: CodableObject;
  index?: number;
  next: string | null;
}

interface Condition {
  object: CodableObject;
  operator: Op;
  value?: string;
  positive: string | null;
  negative: string | null;
}

interface Config {
  version: "0.1";
  template: string;
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
  pronunciation?: PronunciationConfig;
  encoder: {
    sources: Record<string, Source>;
    conditions: Record<string, Condition>;
  };
}

export type { SieveName, Selector, Classifier, Mapping };

export type { Config, FormConfig, PronunciationConfig };

export type { Source, Condition };

export type { TotalCache, TotalResult, EncoderResult };
