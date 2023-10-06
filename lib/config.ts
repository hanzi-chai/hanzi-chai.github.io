import { Compound, Glyph } from "./data";

type SieveName = "根少优先" | "笔顺优先" | "能连不交" | "能散不连" | "取大优先";

type Selector = SieveName[];

type Classifier = Record<string, number>;

type Aliaser = Record<string, { source: string; indices: number[] }>;

type Mapping = Record<string, string>;

interface RootConfig {
  type: "字根";
  nodes: ("字根 1" | "字根 2" | "字根 3")[];
  analysis: {
    selector: Selector;
    classifier: Classifier;
  };
  aliaser: Aliaser;
  mapping: Mapping;
}

interface PhoneticConfig {
  type: "字音";
  nodes: ("首字母" | "末字母" | "声" | "韵" | "调" | "自定义")[];
  analysis: null;
  mapping: "id" | Record<string, string>;
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
  operator: "是" | "不是" | "是空的" | "不是空的";
  value?: string;
}

interface EncoderEdge {
  to: number;
  condition?: Condition;
}

interface Config {
  info: {
    name: string;
    author: string;
    version: string;
    description: string;
  };
  data: {
    component: Record<string, Glyph>;
    compound: Record<string, Compound>;
    character: Record<string, string[]>;
  };
  elements: ElementConfig[];
  encoder: EncoderNode[];
}

export type { SieveName, Selector, Classifier, Aliaser, Mapping };

export type { Config, ElementConfig, RootConfig, PhoneticConfig };

export type { EncoderNode, EncoderEdge, Condition };

export type { ElementCache, ElementResult };
