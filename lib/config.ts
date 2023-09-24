import { Component, Compound } from "./data";
import { Sieve, bias, length, order, crossing, attaching } from "./selector";

type SieveName = "根少优先" | "笔顺优先" | "能连不交" | "能散不连" | "取大优先";

type Selector = SieveName[];

type Classifier = Record<string, number>;

type Aliaser = Record<string, { source: string; indices: number[] }>;

type Mapping = Record<string, string>;

interface RootConfig {
  type: "root";
  analysis: {
    selector: Selector;
    classifier: Classifier;
  };
  aliaser: Aliaser;
  mapping: Mapping;
}

interface PhoneticConfig {
  type: "phonetic";
  analysis: { regex: string } | { preset: string };
  mapping: "id" | Record<string, string>;
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

export const sieveMap = new Map<SieveName, Sieve<number> | Sieve<number[]>>([
  ["根少优先", length],
  ["笔顺优先", order],
  ["取大优先", bias],
  ["能连不交", crossing],
  ["能散不连", attaching],
]);

export type { SieveName, Selector, Classifier, Aliaser, Mapping };

export type { Config, ElementConfig, RootConfig, PhoneticConfig };
