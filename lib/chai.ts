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
  classifier: Record<number, string[]>
  roots: string[];
}

export type { Config };
