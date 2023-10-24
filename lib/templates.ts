import { Config } from "./config";
import { deepcopy } from "./utils";

const getInfo = (name: string) => ({
  name,
  author: "无名氏",
  version: "0.1.0",
  description: "从模板创建",
});

const nullData: Config["data"] = {
  form: {},
  repertoire: {},
  classifier: {},
};

export const createBasicConfig = function (): Config {
  return {
    version: "0.0.0",
    source: "basic",
    info: getInfo("基本模板"),
    data: deepcopy(nullData),
    form: {
      alphabet: "qwertyuiopasdfghjklzxcvbnm",
      maxcodelen: 1,
      grouping: {},
      mapping: {},
      analysis: {
        selector: ["笔顺优先", "取大优先"],
      },
    },
    encoder: {
      sources: {
        s0: { next: null },
      },
      conditions: {},
    },
  };
};
