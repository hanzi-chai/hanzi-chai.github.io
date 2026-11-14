import { 合并分类器, type 分类器 } from "./classifier.js";
import { 默认退化配置 } from "./component.js";
import type { 编码配置, 配置, 键盘配置 } from "./config.js";
import { 默认筛选器列表 } from "./selector.js";

export type Example =
  // 音码
  | "snow4"
  | "longma"
  // 音形
  | "jdh"
  | "shouyou"
  | "xkjd"
  | "cqkm"
  // 形音
  | "bxm"
  | "mswb"
  | "ziyuan"
  // 形码
  | "easy"
  | "huma"
  | "tianma"
  | "sapphire"
  | "xuma"
  | "yustar"
  | "yujoy"
  | "zhangma"
  | "zhengma"
  | "zhenma";

export const classifierTypes = [
  "国标五分类",
  "表形码六分类",
  "郑码七分类",
] as const;
export type ClassifierType = (typeof classifierTypes)[number];

export const keyboardTypes = [
  "冰雪四拼",
  "龙码",
  "简单鹤",
  "首右拼音",
  "星空键道",
  "超强快码",
  "表形码",
  "米十五笔",
  "字源",
  "星陈",
  "卿云",
  "郑码",
  "真码",
  "张码",
  "徐码",
  "虎码",
  "天码",
  "蓝宝石",
  "无",
] as const;
export type KeyboardTypes = (typeof keyboardTypes)[number];

export const encoderTypes = [
  "音码（冰雪四拼）",
  "音码（龙码）",
  "音形码（简单鹤）",
  "音形码（首右拼音）",
  "音形码（星空键道）",
  "音形码（超强快码）",
  "形音码（表形码）",
  "形音码（米十五笔）",
  "形音码（字源）",
  "单编形码（张码）",
  "单编形码（蓝宝石）",
  "双编形码（郑码）",
  "双编形码（真码）",
  "双编形码（徐码）",
  "双编形码（易码）",
  "双编形码（星陈）",
  "双编形码（卿云）",
  "双编形码（虎码）",
  "双编形码（天码）",
] as const;
export type EncoderTypes = (typeof encoderTypes)[number];
export interface StarterType {
  name: string;
  data: ClassifierType;
  keyboard: KeyboardTypes;
  encoder: EncoderTypes;
}

export function 创建方案模板(示例: Record<Example, 配置>) {
  // 私有副本防止调用方后续编辑示例时改变预设。
  const examples = structuredClone(示例);
  const classifierMap: Record<ClassifierType, 分类器> = {
    国标五分类: {} as 分类器,
    表形码六分类: examples.mswb.analysis?.classifier ?? ({} as 分类器),
    郑码七分类: examples.zhengma.analysis?.classifier ?? ({} as 分类器),
  };
  const keyboardMap: Record<KeyboardTypes, 键盘配置> = {
    冰雪四拼: examples.snow4.form,
    龙码: examples.longma.form,
    简单鹤: examples.jdh.form,
    首右拼音: examples.shouyou.form,
    星空键道: examples.xkjd.form,
    超强快码: examples.cqkm.form,
    表形码: examples.bxm.form,
    米十五笔: examples.mswb.form,
    字源: examples.ziyuan.form,
    星陈: examples.yustar.form,
    卿云: examples.yujoy.form,
    郑码: examples.zhengma.form,
    真码: examples.zhenma.form,
    张码: examples.zhangma.form,
    徐码: examples.xuma.form,
    虎码: examples.huma.form,
    天码: examples.tianma.form,
    蓝宝石: examples.sapphire.form,
    无: {
      alphabet: "qwertyuiopasdfghjklzxcvbnm",
      mapping: {},
    },
  };
  const encoderMap: Record<EncoderTypes, 编码配置> = {
    "音码（冰雪四拼）": examples.snow4.encoder,
    "音码（龙码）": examples.longma.encoder,
    "音形码（简单鹤）": examples.jdh.encoder,
    "音形码（首右拼音）": examples.shouyou.encoder,
    "音形码（星空键道）": examples.xkjd.encoder,
    "音形码（超强快码）": examples.cqkm.encoder,
    "形音码（表形码）": examples.bxm.encoder,
    "形音码（米十五笔）": examples.mswb.encoder,
    "形音码（字源）": examples.ziyuan.encoder,
    "单编形码（张码）": examples.zhangma.encoder,
    "单编形码（蓝宝石）": examples.sapphire.encoder,
    "双编形码（郑码）": examples.zhengma.encoder,
    "双编形码（真码）": examples.zhenma.encoder,
    "双编形码（徐码）": examples.xuma.encoder,
    "双编形码（易码）": examples.easy.encoder,
    "双编形码（星陈）": examples.yustar.encoder,
    "双编形码（卿云）": examples.yujoy.encoder,
    "双编形码（虎码）": examples.huma.encoder,
    "双编形码（天码）": examples.tianma.encoder,
  };
  const createConfig = (starter: StarterType): 配置 => {
    const config: 配置 = structuredClone({
      version: "0.4",
      source: null,
      info: {
        name: starter.name,
        author: "无名氏",
        version: "1.0.0",
        description: "从模板创建",
      },
      analysis: {
        classifier: classifierMap[starter.data],
        degenerator: 默认退化配置,
        selector: 默认筛选器列表,
      },
      form: keyboardMap[starter.keyboard],
      encoder: encoderMap[starter.encoder],
    });
    for (const value of Object.values(
      合并分类器(config.analysis!.classifier!),
    )) {
      const element = value.toString();
      if (!config.form.mapping[element]) {
        const key = config.form.alphabet?.[0];
        if (!key) throw new Error("键盘预设缺少可用于补全笔画的字母表");
        config.form.mapping[element] = key;
      }
    }
    return config;
  };
  const defaultConfig = createConfig({
    name: "",
    data: "国标五分类",
    keyboard: "无",
    encoder: "形音码（米十五笔）",
  });
  return {
    classifierTypes,
    keyboardTypes,
    encoderTypes,
    createConfig,
    defaultConfig,
  };
}
