import { Component, Compound } from "./data";

type SieveName = "根少优先" | "笔顺优先" | "能连不交" | "能散不连" | "取大优先";

type Selector = SieveName[];

type Classifier = Record<string, number>;

type Aliaser = Record<string, { source: string; indices: number[] }>;

type Mapping = Record<string, string>;

interface RootConfig {
  type: "字根";
  nodes: string[];
  analysis: {
    selector: Selector;
    classifier: Classifier;
  };
  aliaser: Aliaser;
  mapping: Mapping;
}

interface PhoneticConfig {
  type: "字音";
  nodes: string[];
  analysis: {
    type: "initial" | "final" | "sheng" | "yun" | "diao" | "custom";
    regex?: string;
  };
  mapping: "id" | Record<string, string>;
}

interface ElementCache {
  [key: string]: Record<string, string>;
}

type ElementConfig = RootConfig | PhoneticConfig;

interface Config {
  info: {
    name: string;
    author: string;
    version: string;
    description: string;
  };
  data: {
    component: Record<string, Component>;
    compound: Record<string, Compound>;
    character: Record<string, string[]>;
  };
  elements: ElementConfig[];
  encoder: null;
}

export type { SieveName, Selector, Classifier, Aliaser, Mapping };

export type { Config, ElementConfig, RootConfig, PhoneticConfig };

export type { ElementCache };
