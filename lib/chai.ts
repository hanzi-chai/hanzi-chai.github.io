type SieveName = "根少优先" | "笔顺优先" | "能连不交、能散不连" | "取大优先";

interface Config {
  info: {
    id: string;
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

export type { Config };
