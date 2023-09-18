import { Sieve, bias, length, order, crossing, attaching } from "./selector";

type SieveName = "根少优先" | "笔顺优先" | "能连不交" | "能散不连" | "取大优先";

interface Config {
  info: {
    name: string;
    author: string;
    version: string;
    description: string;
  };
  selector: SieveName[];
  classifier: Record<string, string[]>;
  roots: string[];
  aliaser: Record<string, { source: string; indices: number[] }>;
}

export const sieveMap = new Map<SieveName, Sieve>([
  ["根少优先", length],
  ["笔顺优先", order],
  ["取大优先", bias],
  ["能连不交", crossing],
  ["能散不连", attaching],
]);

export type { Config };
