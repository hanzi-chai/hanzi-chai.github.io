import { Classifier } from "./classifier";
import type { Analysis, Config, Keyboard } from "./config";
import { defaultDegenerator } from "./degenerator";
import { defaultSelector } from "./selector";
import snow from "../../examples/snow.yaml";
import mswb from "../../examples/mswb.yaml";
import flypy from "../../examples/flypy.yaml";
import easy from "../../examples/easy.yaml";
import yustar from "../../examples/yustar.yaml";
import zhengma from "../../examples/zhengma.yaml";
import type { ExampleConfig } from "./config";

export type Example = "snow" | "flypy" | "mswb" | "easy" | "zhengma" | "yustar";

export const examples: Record<Example, ExampleConfig> = {
  snow: snow as ExampleConfig,
  mswb: mswb as ExampleConfig,
  flypy: flypy as ExampleConfig,
  easy: easy as ExampleConfig,
  zhengma: zhengma as ExampleConfig,
  yustar: yustar as ExampleConfig,
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

export const keyboardTypes = ["郑码", "米十五笔", "宇浩·星陈", "无"] as const;
export type KeyboardTypes = (typeof keyboardTypes)[number];
const keyboardMap: Record<KeyboardTypes, Config["form"]> = {
  郑码: examples.zhengma.form,
  米十五笔: examples.mswb.form,
  宇浩·星陈: examples.yustar.form,
  无: {
    alphabet: "qwertyuiopasdfghjklzxcvbnm",
    grouping: {},
    mapping: {},
  },
};

export const encoderTypes = [
  "形音码（米十五笔）",
  "双编形码（郑码）",
  "双编形码（易码）",
  "双编形码（宇浩·星陈、虎码）",
] as const;
export type EncoderTypes = (typeof encoderTypes)[number];
const encoderMap: Record<EncoderTypes, Config["encoder"]> = {
  "形音码（米十五笔）": examples.mswb.encoder,
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
  return {
    version: APP_VERSION,
    source: null,
    info: {
      name: starter.name,
      author: "无名氏",
      version: "0.1.0",
      description: "从模板创建",
    },
    analysis: {
      classifier: classifierMap[starter.data]!,
      degenerator: defaultDegenerator,
      selector: defaultSelector,
    },
    form: keyboardMap[starter.keyboard],
    encoder: encoderMap[starter.encoder],
  };
};

export const defaultConfig = createConfig({
  name: "",
  data: "国标五分类",
  keyboard: "无",
  encoder: "形音码（米十五笔）",
});
