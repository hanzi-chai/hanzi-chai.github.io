import { 默认退化配置, 分类器, 合并分类器, 示例配置, 编码配置, 配置, 键盘配置, 默认筛选器列表 } from "~/lib";
import snow4 from "../examples/snow4.yaml";
import bxm from "../examples/bxm.yaml";
import mswb from "../examples/mswb.yaml";
import ziyuan from "../examples/ziyuan.yaml";
import jdh from "../examples/jdh.yaml";
import cqkm from "../examples/cqkm.yaml";
import shouyou from "../examples/shouyou.yaml";
import xkjd from "../examples/xkjd.yaml";
import longma from "../examples/longma.yaml";
import easy from "../examples/easy.yaml";
import yustar from "../examples/yustar.yaml";
import yujoy from "../examples/yujoy.yaml";
import tianma from "../examples/tianma.yaml";
import zhengma from "../examples/zhengma.yaml";
import zhenma from "../examples/zhenma.yaml";
import zhangma from "../examples/zhangma.yaml";
import xuma from "../examples/xuma.yaml";
import huma from "../examples/huma.yaml";
import sapphire from "../examples/sapphire.yaml";


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

export const examples = {
  snow4,
  longma,
  jdh,
  shouyou,
  xkjd,
  cqkm,
  bxm,
  mswb,
  ziyuan,
  easy,
  huma,
  tianma,
  sapphire,
  xuma,
  yustar,
  yujoy,
  zhangma,
  zhengma,
  zhenma,
} as Record<Example, 示例配置>;

export const classifierTypes = [
  "国标五分类",
  "表形码六分类",
  "郑码七分类",
] as const;
export type ClassifierType = (typeof classifierTypes)[number];
const classifierMap: Record<ClassifierType, 分类器> = {
  国标五分类: {} as 分类器,
  表形码六分类: examples.mswb.analysis.classifier!,
  郑码七分类: examples.zhengma.analysis.classifier!,
};

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

export interface StarterType {
  name: string;
  data: ClassifierType;
  keyboard: KeyboardTypes;
  encoder: EncoderTypes;
}

export const createConfig = (starter: StarterType): 配置 => {
  const form = keyboardMap[starter.keyboard];
  const classifier = classifierMap[starter.data];

  // 确保笔画都在 mapping 里
  for (const value of Object.values(合并分类器(classifier))) {
    const element = value.toString();
    if (!form.mapping[element]) {
      form.mapping[element] = form.alphabet?.[0]!;
    }
  }

  return {
    version: "0.3",
    source: null,
    info: {
      name: starter.name,
      author: "无名氏",
      version: "1.0.0",
      description: "从模板创建",
    },
    analysis: {
      classifier,
      degenerator: 默认退化配置,
      selector: 默认筛选器列表,
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
