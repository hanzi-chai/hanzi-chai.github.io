import { Mapping } from "./config";
import { Stroke } from "./data";

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
  feature: string,
  schema: ("h" | "v" | "l" | "c")[],
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

export const reverse = (alphabet: string, mapping: Mapping) => {
  const data: Record<string, string[]> = Object.fromEntries(
    Array.from(alphabet).map((key) => [key, []]),
  );
  for (const [root, key] of Object.entries(mapping)) {
    data[key]?.push(root);
  }
  return data;
};
