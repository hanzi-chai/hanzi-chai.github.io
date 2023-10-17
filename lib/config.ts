import { Components, Compounds, Characters, Slices } from "./data";

type SieveName = "根少优先" | "笔顺优先" | "能连不交" | "能散不连" | "取大优先";

type Selector = SieveName[];

type Classifier = Record<string, number>;

type Mapping = Record<string, string>;

interface BaseConfig {
  type: string;
  alphabet: string;
}

interface RootConfig extends BaseConfig {
  type: "字根";
  nodes: ("字根 1" | "字根 2" | "字根 3")[];
  analysis: {
    selector: Selector;
  };
  mapping: Mapping;
}

type PhoneticElement = "首字母" | "末字母" | "声" | "韵" | "调";

interface PhoneticConfig extends BaseConfig {
  type: "字音";
  nodes: [PhoneticElement];
  mapping: Mapping;
}

type ElementResult = Record<string, string>;

interface ElementCache {
  [key: string]: ElementResult[];
}

type EncoderResult = Record<string, string[]>;

type ElementConfig = RootConfig | PhoneticConfig;

interface Source {
  label: string;
  next: string | null;
}

interface Condition {
  label: string;
  operator: "是" | "不是" | "有" | "没有";
  value?: string;
  positive: string | null;
  negative: string | null;
}

interface Config {
  info: {
    name: string;
    author: string;
    version: string;
    description: string;
  };
  data: {
    components: Components;
    compounds: Compounds;
    characters: Characters;
    slices: Slices;
    classifier: Classifier;
  };
  elements: ElementConfig[];
  encoder: {
    sources: Source[];
    conditions: Condition[];
  };
}

export type { SieveName, Selector, Classifier, Mapping };

export type {
  Config,
  ElementConfig,
  RootConfig,
  PhoneticConfig,
  PhoneticElement,
};

export type { Source, Condition };

export type { ElementCache, ElementResult, EncoderResult };
