import type { Config, FormConfig, PartialClassifier } from "./config";
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
  表形码六分类: examples.mswb.data.classifier!,
  郑码七分类: examples.zhengma.data.classifier!,
};

const getData = function (ct: ClassifierType): Config["data"] {
  return {
    form: {},
    repertoire: {},
    classifier: classifierMap[ct],
  };
};

export const defaultForm: FormConfig = {
  alphabet: "qwertyuiopasdfghjklzxcvbnm",
  grouping: {},
  mapping: {},
  analysis: {
    degenerator: defaultDegenerator,
    selector: defaultSelector,
  },
};

export const formTypes = ["郑码字根", "米十五笔字根", "无"] as const;
export type FormTypes = (typeof formTypes)[number];
const formMap: Record<FormTypes, Config["form"]> = {
  郑码字根: examples.zhengma.form,
  米十五笔字根: examples.mswb.form,
  无: defaultForm,
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
  form: FormTypes;
  encoder: EncoderTypes;
}

export const createConfig = function (starter: StarterType): Config {
  return {
    version: APP_VERSION,
    source: null,
    info: getInfo(starter.name),
    data: getData(starter.data),
    form: formMap[starter.form],
    encoder: encoderMap[starter.encoder],
  };
};
