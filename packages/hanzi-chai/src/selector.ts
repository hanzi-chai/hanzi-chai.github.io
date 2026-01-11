import type { SchemeWithData, 部件图形 } from "./component.js";
import { type Analysis, type Element, type Value, isMerge } from "./config.js";
import type { AnalysisConfig } from "./repertoire.js";
import type { 曲线关系 } from "./bezier.js";
import { isLess } from "./math.js";
import { isEqual } from "lodash-es";
import { 注册表 } from "./registry.js";

export const defaultSelector: string[] = [
  "结构完整",
  "根少优先",
  "能连不交",
  "能散不连",
  "全符笔顺",
  "取大优先",
];

interface 拆分字根信息 {
  名称: string;
  笔画索引: number[];
  笔画二进制表示: number;
}

export type 拆分方式 = 拆分字根信息[];

export interface Environment {
  component: 部件图形;
  rootMap: Map<number, string>;
  analysis: Analysis;
  roots: Map<Element, Value>;
}

export interface 筛选器 {
  evaluate: (scheme: 拆分方式, environment: Environment) => number[];
}

class 根少优先 implements 筛选器 {
  static readonly type = "根少优先";
  evaluate(scheme: 拆分方式) {
    return [scheme.length];
  }
}

/**
 * 规则：取大优先
 *
 * 让顺序靠前的字根尽量取到更多的笔画
 */
class 取大优先 implements 筛选器 {
  static readonly type = "取大优先";
  evaluate(scheme: 拆分方式) {
    return scheme.map((x) => -x.笔画索引.length);
  }
}

/**
 * 规则：取小优先
 *
 * 让顺序靠前的字根尽量取到更少的笔画
 */
class 取小优先 implements 筛选器 {
  static readonly type = "取小优先";
  evaluate(scheme: 拆分方式) {
    return scheme.map((x) => x.笔画索引.length);
  }
}

/**
 * 规则：全符笔顺
 *
 * 各个字根中笔画的顺序连在一起是否与整个部件的笔顺相同，相同者优先
 * 该规则采集自三码郑码的文档
 *
 * @see https://www.yuque.com/smzm/zhengma/otb32d
 */
class 全符笔顺 implements 筛选器 {
  static readonly type = "全符笔顺";
  evaluate(scheme: 拆分方式) {
    const indices = scheme.flatMap((x) => x.笔画索引);
    const isSorted = indices.every((value, index) => value === index);
    return [Number(!isSorted)];
  }
}

/**
 * 规则：连续笔顺
 *
 * 字根是否由部件中连续的几个笔画构成，不符合此特点的字根数量少者优先。该规则采集自宇浩输入法的文档。
 *
 * @see https://zhuyuhao.com/yuhao/docs/learn.html#符合笔顺
 */
class 连续笔顺 implements 筛选器 {
  static readonly type = "连续笔顺";
  evaluate(scheme: 拆分方式) {
    let unsorted = 0;
    // 如果一个字根不是由连续的笔画构成，那么称它是不连续的
    // 让不连续的字根数量少者优先
    for (const { 笔画索引 } of scheme) {
      const sortedIndices = [...笔画索引].sort((a, b) => a - b);
      if (!isEqual(笔画索引, sortedIndices)) {
        unsorted += 1;
      }
    }
    return [unsorted];
  }
}

/**
 * 规则：非形近根
 *
 * 尽量少使用被归并到其他字根的字根。该规则采集自三码郑码的文档
 *
 * @see https://www.yuque.com/smzm/zhengma/otb32d
 */
class 非形近根 implements 筛选器 {
  static readonly type = "非形近根";
  evaluate(scheme: 拆分方式, { roots }: Environment) {
    let 形近根数量 = 0;
    for (const { 名称 } of scheme) {
      const value = roots.get(名称);
      if (value && isMerge(value)) {
        形近根数量 += 1;
      }
    }
    return [形近根数量];
  }
}

/**
 * 规则：强字根
 *
 * 尽量多使用特定的一些字根。该规则采集自郑码的文档
 */
class 多强字根 implements 筛选器 {
  static readonly type = "多强字根";
  evaluate(scheme: 拆分方式, { analysis }: Environment) {
    const 强字根列表 = analysis?.strong || [];
    const count = scheme.filter((x) => 强字根列表.includes(x.名称)).length;
    return [-count];
  }
}

/**
 * 规则：弱字根
 *
 * 尽量避免使用特定的一些字根
 */
class 少弱字根 implements 筛选器 {
  static readonly type = "少弱字根";
  evaluate(scheme: 拆分方式, { analysis }: Environment) {
    const weak = analysis?.weak || [];
    const count = scheme.filter((x) => weak.includes(x.名称)).length;
    return [count];
  }
}

const 计算出现次数 = (
  relationType: 曲线关系["type"],
  avoidRelationType: 曲线关系["type"][],
  scheme: 拆分方式,
  component: 部件图形,
) => {
  let count = 0;
  for (const [i, { 笔画索引: bi }] of scheme.entries()) {
    for (const [j, { 笔画索引: bj }] of scheme.entries()) {
      if (j >= i) continue;
      let r = false;
      let a = false;
      for (const k of bi) {
        for (const l of bj) {
          const relations = component.查询拓扑关系(k, l);
          r ||= relations.some((v) => v.type === relationType);
          a ||= relations.some((v) => avoidRelationType.includes(v.type));
        }
      }
      if (!a) count += Number(r);
    }
  }
  return count;
};

/**
 * 规则：能连不交
 *
 * 尽量让字根不交叉。该规则采集自五笔
 */
class 能连不交 implements 筛选器 {
  static readonly type = "能连不交";
  evaluate(scheme: 拆分方式, { component }: Environment) {
    const crosses = 计算出现次数("交", [], scheme, component);
    return [crosses];
  }
}

/**
 * 规则：能散不连
 *
 * 尽量让字根不相连。该规则采集自五笔
 */
class 能散不连 implements 筛选器 {
  static readonly type = "能散不连";
  evaluate(scheme: 拆分方式, { component }: Environment) {
    const connects = 计算出现次数("连", ["交"], scheme, component);
    return [connects];
  }
}

/**
 * 规则：同向笔画
 *
 * 尽量让方向相同的笔画包含在同一个字根里。该规则采集自五笔
 */
class 同向笔画 implements 筛选器 {
  static readonly type = "同向笔画";
  evaluate(scheme: 拆分方式, { component }: Environment) {
    let totalCrosses = 0;
    for (const [i, { 笔画索引: bi }] of scheme.entries()) {
      for (const [j, { 笔画索引: bj }] of scheme.entries()) {
        if (j >= i) continue;
        let r = false;
        for (const k of bi) {
          for (const l of bj) {
            const oriented = component.具有同向笔画(k, l);
            r ||= oriented;
          }
        }
        totalCrosses += Number(r);
      }
    }
    return [totalCrosses];
  }
}

/**
 * 规则：结构完整
 *
 * 避免框类部件被拆散。该规则采集自宇浩输入法的文档
 *
 * @see https://zhuyuhao.com/yuhao/docs/learn.html#结构完整
 */
class 结构完整 implements 筛选器 {
  static readonly type = "结构完整";
  evaluate(scheme: 拆分方式, { rootMap }: Environment) {
    const priorities = [
      "口",
      "囗",
      "冂",
      "\ue439" /* 见二 */,
      "匚",
      "凵",
      "\ue009" /* 假右角 */,
      "勹",
      "尸",
      "\ue407" /* 央三 */,
    ];
    let 破坏结构完整 = 0;
    for (const [二进制表示, 名称] of rootMap) {
      if (priorities.includes(名称)) {
        if (
          !scheme.some(({ 笔画二进制表示 }) =>
            结构完整.contains(笔画二进制表示, 二进制表示),
          )
        ) {
          破坏结构完整 += 1;
        }
      }
    }
    return [破坏结构完整];
  }

  /**
   * @param b1 - 以二进制数表示的切片
   * @param b2 - 同上
   * @returns 第一个切片是否包含第二个切片
   */
  static contains(b1: number, b2: number) {
    return (b1 | b2) === b1;
  }
}

/**
 * 选择最优的拆分方案
 *
 * @param config - 配置
 * @param component - 待拆分部件
 * @param 拆分方式列表 - 拆分方案列表
 * @param rootMap - 字根映射，从切片的二进制表示到字根名称的映射
 */
export const select = (
  config: AnalysisConfig,
  component: 部件图形,
  拆分方式列表: 拆分方式[],
  rootMap: Map<number, string>,
  必要字根: Set<string>,
): SchemeWithData[] => {
  const environment: Environment = {
    component,
    rootMap,
    ...config,
  };
  const 筛选器列表: [string, 筛选器][] = [];
  for (const name of config.analysis.selector ?? defaultSelector) {
    const 筛选器 = 注册表.实例().创建筛选器(name);
    if (筛选器) {
      筛选器列表.push([name, 筛选器]);
    }
  }
  const 拆分方式与评价列表 = 拆分方式列表.map((拆分方式) => {
    const 评价: Map<string, number[]> = new Map();
    for (const [name, 筛选器] of 筛选器列表) {
      const 取值 = 筛选器.evaluate(拆分方式, environment);
      评价.set(name, 取值);
    }
    return { 拆分方式, 评价, 可用: false };
  });
  拆分方式与评价列表.sort((a, b) => {
    for (const [name, _] of 筛选器列表) {
      const aValue = a.评价.get(name)!;
      const bValue = b.评价.get(name)!;
      if (isLess(aValue, bValue)) return -1;
      if (isLess(bValue, aValue)) return 1;
    }
    return 0;
  });
  const 包含可选字根列表 = 拆分方式与评价列表.map((x) =>
    x.拆分方式.map((y) => y.名称).filter((y) => !必要字根.has(y)),
  );
  for (const [index, data] of 拆分方式与评价列表.entries()) {
    data.可用 = true;
    for (let prevIndex = 0; prevIndex !== index; ++prevIndex) {
      const current = 包含可选字根列表[index]!;
      const previous = 包含可选字根列表[prevIndex]!;
      if (previous.every((x) => current.includes(x))) {
        data.可用 = false;
        break;
      }
    }
    if (data.拆分方式.every((x) => 必要字根.has(x.名称))) {
      break;
    }
  }
  return 拆分方式与评价列表;
};

export {
  根少优先,
  取大优先,
  取小优先,
  全符笔顺,
  连续笔顺,
  非形近根,
  多强字根,
  少弱字根,
  能连不交,
  能散不连,
  同向笔画,
  结构完整,
};
