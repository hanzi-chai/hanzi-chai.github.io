import { 星空键道组装器, 默认组装器 } from "./assembly.js";
import {
  二笔部件分析器,
  张码部件分析器,
  逸码部件分析器,
  默认部件分析器,
} from "./component.js";
import {
  二笔复合体分析器,
  张码复合体分析器,
  星空键道复合体分析器,
  真码复合体分析器,
  逸码复合体分析器,
  首右复合体分析器,
  默认复合体分析器,
} from "./compound.js";
import { 默认拼音分析器 } from "./pinyin.js";
import { 注册表 } from "./registry.js";
import {
  全符笔顺,
  取大优先,
  取小优先,
  同向笔画,
  多强字根,
  少弱字根,
  根少优先,
  结构完整,
  能散不连,
  能连不交,
  连续笔顺,
  非形近根,
} from "./selector.js";

export * from "./affine.js";
export * from "./assembly.js";
export * from "./bezier.js";
export * from "./classifier.js";
export * from "./component.js";
export * from "./compound.js";
export * from "./config.js";
export * from "./data.js";
export * from "./element.js";
export * from "./math.js";
export * from "./pinyin.js";
export * from "./primitive.js";
export * from "./registry.js";
export * from "./repertoire.js";
export * from "./selector.js";
export * from "./unicode.js";
export * from "./utils.js";

let 注册表实例: 注册表 | undefined;

export function 获取注册表() {
  if (!注册表实例) {
    注册表实例 = new 注册表();
    注册内置组件(注册表实例);
  }
  return 注册表实例;
}

export function 注册内置组件(registry: 注册表) {
  for (const x of [
    默认部件分析器,
    二笔部件分析器,
    张码部件分析器,
    逸码部件分析器,
  ])
    registry.注册部件分析器(x);
  for (const x of [
    默认复合体分析器,
    二笔复合体分析器,
    张码复合体分析器,
    逸码复合体分析器,
    真码复合体分析器,
    星空键道复合体分析器,
    首右复合体分析器,
  ])
    registry.注册复合体分析器(x);
  for (const x of [默认组装器, 星空键道组装器]) registry.注册组装器(x);
  for (const x of [默认拼音分析器]) registry.注册拼音分析器(x);
  for (const x of [
    全符笔顺,
    取大优先,
    取小优先,
    同向笔画,
    多强字根,
    少弱字根,
    根少优先,
    结构完整,
    能散不连,
    能连不交,
    连续笔顺,
    非形近根,
  ])
    registry.注册筛选器(x);
  return registry;
}
