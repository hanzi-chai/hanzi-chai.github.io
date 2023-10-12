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

type ElementResult = Record<string, string | undefined>;

interface ElementCache {
  [key: string]: ElementResult;
}

type ElementConfig = RootConfig | PhoneticConfig;

interface EncoderNode {
  key: string;
  children: EncoderEdge[];
}

interface Condition {
  key: string;
  operator: "是" | "不是" | "有" | "没有";
  value?: string;
}

interface EncoderEdge {
  to: number;
  conditions: Condition[];
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
  encoder: EncoderNode[];
}

export type { SieveName, Selector, Classifier, Mapping };

export type {
  Config,
  ElementConfig,
  RootConfig,
  PhoneticConfig,
  PhoneticElement,
};

export type { EncoderNode, EncoderEdge, Condition };

export type { ElementCache, ElementResult };
