import { isEqual } from "lodash-es";
import type { 曲线关系 } from "./bezier.js";
import type { 部件图形 } from "./component.js";
import { type 分析配置, type 元素, type 安排, 是归并 } from "./config.js";

const 默认筛选器列表: string[] = [
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

type 拆分方式 = 拆分字根信息[];

interface 拆分环境 {
  部件图形: 部件图形;
  二进制字根映射: Map<number, string>;
  分析配置: 分析配置;
  字根决策: Map<元素, 安排>;
}

interface 筛选器 {
  评价: (scheme: 拆分方式, environment: 拆分环境) => number[];
}

class 根少优先 implements 筛选器 {
  static readonly type = "根少优先";
  评价(scheme: 拆分方式) {
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
  评价(scheme: 拆分方式) {
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
  评价(scheme: 拆分方式) {
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
  评价(scheme: 拆分方式) {
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
 * @see https://shurufa.app/learn/division#符合笔顺
 */
class 连续笔顺 implements 筛选器 {
  static readonly type = "连续笔顺";
  评价(scheme: 拆分方式) {
    let unsorted = 0;
    // 如果一个字根不是由连续的笔画构成，那么称它是不连续的
    // 让不连续的字根数量少者优先
    for (const { 笔画索引 } of scheme) {
      const sortedIndices = [...笔画索引].sort((a, b) => a - b);
      const diff = (sortedIndices.at(-1) ?? 0) - (sortedIndices[0] ?? 0);
      if (sortedIndices.length !== diff + 1) {
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
  评价(scheme: 拆分方式, { 字根决策: roots }: 拆分环境) {
    let 形近根数量 = 0;
    for (const { 名称 } of scheme) {
      const value = roots.get(名称);
      if (value && 是归并(value)) {
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
  评价(scheme: 拆分方式, { 分析配置: analysis }: 拆分环境) {
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
  评价(scheme: 拆分方式, { 分析配置: analysis }: 拆分环境) {
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
          if (!relations) continue;
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
  评价(scheme: 拆分方式, { 部件图形: component }: 拆分环境) {
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
  评价(scheme: 拆分方式, { 部件图形: component }: 拆分环境) {
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
  评价(scheme: 拆分方式, { 部件图形: component }: 拆分环境) {
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
 * @see https://shurufa.app/learn/division#结构完整
 */
class 结构完整 implements 筛选器 {
  static readonly type = "结构完整";
  评价(scheme: 拆分方式, { 二进制字根映射: rootMap }: 拆分环境) {
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

export {
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
  默认筛选器列表,
};
export type { 拆分方式, 拆分环境, 筛选器 };
