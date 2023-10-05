import {
  Cache,
  Condition,
  Config,
  ElementCache,
  EncoderEdge,
  EncoderNode,
} from "./config";

interface CompiledNode extends EncoderNode {
  children: Omit<EncoderEdge, "from">[];
}

type Graph = CompiledNode[];

const table: Record<
  Condition["operator"],
  (target?: string, value?: string) => boolean
> = {
  是: (t, v) => t === v,
  不是: (t, v) => t !== v,
  是空的: (t) => t === undefined,
  不是空的: (t) => t !== undefined,
};

const satisfy = (
  condition: Condition,
  data: Record<string, string | undefined>[],
) => {
  const { index, key, operator, value } = condition;
  const target = data[index][key];
  const fn = table[operator];
  return fn(target, value);
};

const compile =
  (graph: Graph, elements: Config["elements"]) =>
  (character: string, data: Record<string, string>[]) => {
    let node = 0;
    let codes = [] as string[];
    if (character === "天") {
      console.log(graph, data);
    }
    while (graph[node].children.length) {
      for (const { to, condition } of graph[node].children) {
        if (condition === undefined || satisfy(condition, data)) {
          const { index, key } = graph[to];
          const element = data[index][key];
          const mapping = elements[index].mapping;
          codes.push(typeof mapping === "string" ? element : mapping[element]);
          node = to;
          break;
        }
      }
      if (character === "天") {
        console.log(codes);
      }
    }
    return codes.join("");
  };

const encode = (
  encoder: Config["encoder"],
  elements: Config["elements"],
  characters: string[],
  cache: Cache,
) => {
  const graph: Graph = encoder.nodes.map((n) => ({ ...n, children: [] }));
  for (const edge of encoder.edges) {
    graph[edge.from].children.push({
      to: edge.to,
      condition: edge.condition,
    });
  }
  console.log(graph);
  const func = compile(graph, elements);
  const result = {} as Record<string, string>;
  characters.forEach((char) => {
    const data = Object.values(cache).map((x) => x[char]);
    result[char] = func(char, data);
  });
  return result;
};

export default encode;
