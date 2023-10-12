import {
  Condition,
  Config,
  ElementCache,
  ElementResult,
  EncoderEdge,
  EncoderNode,
} from "./config";

export const table: Record<
  Condition["operator"],
  (target?: string, value?: string) => boolean
> = {
  是: (t, v) => t === v,
  不是: (t, v) => t !== v,
  有: (t) => t !== undefined,
  没有: (t) => t === undefined,
};

const satisfy = (condition: Condition, data: ElementResult) => {
  const { key, operator, value } = condition;
  const target = data[key];
  const fn = table[operator];
  return fn(target, value);
};

const compile = (encoder: Config["encoder"], elements: Config["elements"]) => {
  const elementReverseLookup = {} as Record<
    string,
    Record<string, string> | undefined
  >;
  for (const { nodes, mapping } of elements) {
    for (const node of nodes) {
      elementReverseLookup[node] = mapping;
    }
  }
  return (character: string, data: ElementResult) => {
    let node = 0;
    let codes = [] as string[];
    while (encoder[node].children.length) {
      for (const { to, conditions } of encoder[node].children) {
        if (conditions.every((x) => satisfy(x, data))) {
          const { key } = encoder[to];
          const element = data[key]!;
          const mapping = elementReverseLookup[key];
          codes.push(mapping === undefined ? element : mapping[element]);
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
