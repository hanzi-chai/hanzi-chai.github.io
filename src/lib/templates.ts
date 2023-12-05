import type { Config, FormConfig, PartialClassifier } from "./config";
import { examples } from "./example";

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
  表形码六分类: examples.mswb.data.classifier,
  郑码七分类: examples.zhengma.data.classifier,
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
  maxcodelen: 1,
  grouping: {},
  mapping: {},
  analysis: {
    degenerator: {
      feature: {
        提: "横",
        捺: "点",
      },
      nocross: false,
    },
    selector: ["根少优先", "连续笔顺", "能连不交", "取大优先"],
    customize: {},
  },
};

export const formTypes = ["郑码字根", "米十五笔字根", "无"] as const;
export type FormTypes = (typeof formTypes)[number];
const formMap: Record<FormTypes, Config["form"]> = {
  郑码字根: examples.zhengma.form,
  米十五笔字根: examples.mswb.form,
  无: defaultForm,
};

export const pronTypes = ["无", "拼音首字母", "声母", "双拼"] as const;
export type PronTypes = (typeof pronTypes)[number];
const pronMap: Record<PronTypes, Config["pronunciation"]> = {
  无: { alphabet: "", maxcodelen: 1, grouping: {}, mapping: {} },
  拼音首字母: examples.mswb.pronunciation,
  声母: {
    ...examples.mswb.pronunciation!,
    mapping: { zh: "v", ch: "i", sh: "u", 零: "o" },
  },
  双拼: examples.flypy.pronunciation,
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
  pron: PronTypes;
  encoder: EncoderTypes;
}

export const createConfig = function (starter: StarterType): Config {
  return {
    version: APP_VERSION,
    info: getInfo(starter.name),
    data: getData(starter.data),
    form: formMap[starter.form],
    pronunciation: pronMap[starter.pron],
    encoder: encoderMap[starter.encoder],
  };
};
