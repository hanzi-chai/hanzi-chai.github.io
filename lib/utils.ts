import { Feature } from "./classifier";
import { Mapping } from "./config";
import { SVGCommand, Stroke } from "./data";

export function deepcopy<T>(t: T) {
  return JSON.parse(JSON.stringify(t)) as T;
}

export const halfToFull = (s: string) => {
  let result = "";
  for (let i = 0; i != s.length; ++i) {
    const code = s.charCodeAt(i);
    if (code <= 128) {
      result += String.fromCharCode(code + 65248);
    } else {
      result += s[i];
    }
  }
  return result;
};

export const fullToHalf = (s: string) => {
  let result = "";
  for (let i = 0; i != s.length; ++i) {
    const code = s.charCodeAt(i);
    if (65248 <= code && code <= 65248 + 128) {
      result += String.fromCharCode(code - 65248);
    } else {
      result += s[i];
    }
  }
  return result;
};

export const getDummyStroke = function (
  feature: Feature,
  schema: SVGCommand[],
): Stroke {
  return {
    feature,
    start: [0, 0],
    curveList: schema.map((command) => {
      switch (command) {
        case "h":
          return { command, parameterList: [20] };
        case "v":
          return { command, parameterList: [20] };
        case "l":
          return { command, parameterList: [20, 20] };
        case "c":
          return { command, parameterList: [10, 10, 20, 20, 30, 30] };
      }
    }),
  };
};

export type MappedInfo = { name: string; code: string };

export const reverse = (alphabet: string, mapping: Mapping) => {
  const data: Record<string, MappedInfo[]> = Object.fromEntries(
    Array.from(alphabet).map((key) => [key, []]),
  );
  for (const [name, code] of Object.entries(mapping)) {
    const [main] = [code[0]];
    data[main].push({ name, code });
  }
  return data;
};
