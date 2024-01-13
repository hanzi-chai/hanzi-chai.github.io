import type {
  Analysis,
  Config,
  KeyboardConfig,
  PartialClassifier,
} from "./config";
import { defaultDegenerator } from "./degenerator";
import { examples } from "./example";
import { defaultSelector } from "./selector";

const getInfo = function (name: string): Config["info"] {
  return {
    name,
    author: "无名氏",
    version: "0.1.0",
    description: "从模板创建",
  };
};

export const classifierTypes = [
  "国标五分类",
  "表形码六分类",
  "郑码七分类",
] as const;
export type ClassifierType = (typeof classifierTypes)[number];
const classifierMap: Record<ClassifierType, PartialClassifier> = {
  国标五分类: {},
  表形码六分类: examples.mswb.analysis!.classifier!,
  郑码七分类: examples.zhengma.analysis!.classifier!,
};

export const defaultAnalysis: Analysis = {
  degenerator: defaultDegenerator,
  selector: defaultSelector,
};

export const defaultKeyboard: KeyboardConfig = {
  alphabet: "qwertyuiopasdfghjklzxcvbnm",
  grouping: {},
  mapping: {},
};

export const keyboardTypes = ["郑码字根", "米十五笔字根", "无"] as const;
export type KeyboardTypes = (typeof keyboardTypes)[number];
const keyboardMap: Record<KeyboardTypes, Config["keyboards"]> = {
  郑码字根: examples.zhengma.keyboards,
  米十五笔字根: examples.mswb.keyboards,
  无: [defaultKeyboard],
};

export const encoderTypes = [
  "形音码",
  "双编形码（郑码）",
  "双编形码（易码）",
] as const;
export type EncoderTypes = (typeof encoderTypes)[number];
const encoderMap: Record<EncoderTypes, Config["encoder"]> = {
  形音码: examples.mswb.encoder,
  "双编形码（郑码）": examples.zhengma.encoder,
  "双编形码（易码）": examples.yima.encoder,
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
    info: getInfo(starter.name),
    keyboards: keyboardMap[starter.keyboard],
    encoder: encoderMap[starter.encoder],
  };
};
