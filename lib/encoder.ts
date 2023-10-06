import {
  Condition,
  Config,
  ElementCache,
  ElementResult,
  EncoderEdge,
  EncoderNode,
} from "./config";

const table: Record<
  Condition["operator"],
  (target?: string, value?: string) => boolean
> = {
  是: (t, v) => t === v,
  不是: (t, v) => t !== v,
  是空的: (t) => t === undefined,
  不是空的: (t) => t !== undefined,
};

const satisfy = (condition: Condition, data: ElementResult) => {
  const { key, operator, value } = condition;
  const target = data[key];
  const fn = table[operator];
  return fn(target, value);
};

const compile = (encoder: Config["encoder"], elements: Config["elements"]) => {
  const elementReverseLookup = {} as Record<string, number>;
  for (const [index, { nodes }] of elements.entries()) {
    for (const node of nodes) {
      elementReverseLookup[node] = index;
    }
  }
  return (character: string, data: ElementResult) => {
    let node = 0;
    let codes = [] as string[];
    while (encoder[node].children.length) {
      for (const { to, condition } of encoder[node].children) {
        if (condition === undefined || satisfy(condition, data)) {
          const { key } = encoder[to];
          const element = data[key]!;
          const mapping = elements[elementReverseLookup[key]].mapping;
          codes.push(typeof mapping === "string" ? element : mapping[element]);
          node = to;
          break;
        }
      }
    }
    return codes.join("");
  };
};

const encode = (
  encoder: Config["encoder"],
  elements: Config["elements"],
  characters: string[],
  cache: ElementCache,
) => {
  const func = compile(encoder, elements);
  const result = {} as Record<string, string>;
  characters.forEach((char) => {
    result[char] = func(char, cache[char]);
  });
  return result;
};

export default encode;
