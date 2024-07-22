import { mergeClassifier, type Classifier } from "./classifier";
import type { Config } from "./config";
import { defaultDegenerator } from "./degenerator";
import { defaultSelector } from "./selector";
import snow from "../../examples/snow.yaml";
import mswb from "../../examples/mswb.yaml";
import jdh from "../../examples/jdh.yaml";
import easy from "../../examples/easy.yaml";
import yustar from "../../examples/yustar.yaml";
import zhengma from "../../examples/zhengma.yaml";
import zhangma from "../../examples/zhangma.yaml";
import type { ExampleConfig } from "./config";

export type Example =
  | "snow"
  | "jdh"
  | "mswb"
  | "easy"
  | "zhengma"
  | "yustar"
  | "zhangma";

export const examples: Record<Example, ExampleConfig> = {
  snow: snow as ExampleConfig,
  mswb: mswb as ExampleConfig,
  jdh: jdh as ExampleConfig,
  easy: easy as ExampleConfig,
  zhengma: zhengma as ExampleConfig,
  yustar: yustar as ExampleConfig,
  zhangma: zhangma as ExampleConfig,
};

export const classifierTypes = [
  "国标五分类",
  "表形码六分类",
  "郑码七分类",
] as const;
export type ClassifierType = (typeof classifierTypes)[number];
const classifierMap: Record<ClassifierType, Classifier> = {
  国标五分类: {} as Classifier,
  表形码六分类: examples.mswb.analysis.classifier!,
  郑码七分类: examples.zhengma.analysis.classifier!,
};

export const keyboardTypes = [
  "米十五笔",
  "宇浩·星陈",
  "郑码",
  "简单鹤",
  "张码",
  "无",
] as const;
export type KeyboardTypes = (typeof keyboardTypes)[number];
const keyboardMap: Record<KeyboardTypes, Config["form"]> = {
  米十五笔: examples.mswb.form,
  宇浩·星陈: examples.yustar.form,
  郑码: examples.zhengma.form,
  简单鹤: examples.jdh.form,
  张码: examples.zhangma.form,
  无: {
    alphabet: "qwertyuiopasdfghjklzxcvbnm",
    grouping: {},
    mapping: {},
  },
};

export const encoderTypes = [
  "音形码（简单鹤）",
  "形音码（米十五笔）",
  "单编形码（张码）",
  "双编形码（郑码）",
  "双编形码（易码）",
  "双编形码（宇浩·星陈、虎码）",
] as const;
export type EncoderTypes = (typeof encoderTypes)[number];
const encoderMap: Record<EncoderTypes, Config["encoder"]> = {
  "音形码（简单鹤）": examples.jdh.encoder,
  "形音码（米十五笔）": examples.mswb.encoder,
  "单编形码（张码）": examples.zhangma.encoder,
  "双编形码（郑码）": examples.zhengma.encoder,
  "双编形码（易码）": examples.easy.encoder,
  "双编形码（宇浩·星陈、虎码）": examples.yustar.encoder,
};

export interface StarterType {
  name: string;
  data: ClassifierType;
  keyboard: KeyboardTypes;
  encoder: EncoderTypes;
}

export const createConfig = function (starter: StarterType): Config {
  const form = keyboardMap[starter.keyboard];
  const classifier = classifierMap[starter.data];

  // 确保笔画都在 mapping 里
  for (const value of Object.values(mergeClassifier(classifier))) {
    const element = value.toString();
    if (!form.mapping[element]) {
      form.mapping[element] = form.alphabet[0]!;
    }
  }

  return {
    version: "0.1",
    source: null,
    info: {
      name: starter.name,
      author: "无名氏",
      version: "0.1.0",
      description: "从模板创建",
    },
    analysis: {
      classifier,
      degenerator: defaultDegenerator,
      selector: defaultSelector,
    },
    form,
    encoder: encoderMap[starter.encoder],
  };
};

export const defaultConfig = createConfig({
  name: "",
  data: "国标五分类",
  keyboard: "无",
  encoder: "形音码（米十五笔）",
});
