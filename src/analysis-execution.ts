import { isEqual } from "lodash-es";
import type { 条件 } from "./config.js";
import type { 字形分析配置 } from "./repertoire.js";
import {
  ok,
  type Result,
  优先表,
  type 字根,
  存在,
  type 带条件,
} from "./utils.js";

/** 分析规则中依赖当前方案的判断和有序候选选择。 */
export interface 分析执行环境 {
  判断(条件: 条件): boolean;
  选择<T extends object>(候选: Iterable<带条件<T>>): 带条件<T> | undefined;
  缓存<T>(配置: object, 输入: object, 计算: () => T): T;
}

export function 创建静态分析环境(判断: (条件: 条件) => boolean): 分析执行环境 {
  const 缓存表 = new WeakMap<object, WeakMap<object, unknown>>();
  return {
    判断,
    缓存<T>(配置: object, 输入: object, 计算: () => T): T {
      let 表 = 缓存表.get(配置);
      if (!表) {
        表 = new WeakMap();
        缓存表.set(配置, 表);
      }
      if (!表.has(输入)) 表.set(输入, 计算());
      return 表.get(输入) as T;
    },
    选择(候选) {
      for (const 项 of 候选) {
        if (项.条件列表.every(判断)) return 项;
      }
      return undefined;
    },
  };
}

/** 固定字根无需分支；可选字根交给当前执行环境决定。 */
export function 字根存在(
  配置: 字形分析配置,
  字根: 字根,
  环境?: 分析执行环境,
): boolean {
  return 环境
    ? !配置.可选字根.has(字根) || 环境.判断(存在(字根))
    : 配置.字根决策.has(字根);
}

class 待决条件 {
  constructor(public 条件: 条件) {}
}

class 无分析结果 {}

/** 必需的子分析无匹配项时，当前动态路径没有结果，不伪造回退。 */
export function 选择分析<T extends object>(
  候选: Iterable<带条件<T>>,
  环境: 分析执行环境,
): 带条件<T> {
  const 结果 = 环境.选择(候选);
  if (结果 === undefined) throw new 无分析结果();
  return 结果;
}

const 取反 = (条件: 条件): 条件 => ({
  ...条件,
  op: 条件.op === "是" ? "不是" : "是",
});

/**
 * 只对执行中实际遇到的未知条件分支，以成立分支优先的顺序重跑规则。
 * 同一条件及其反条件共享决定。内部保留完整路径，输出按优先表顺序回退：
 * 只有成立分支被完整覆盖时，才省略不成立分支上的反条件。
 *
 * 规则必须同步、确定且不修改共享状态；不能吞掉执行环境抛出的内部信号。
 * 选择没有匹配项时返回 undefined；规则返回 ok(undefined) 表示该路径无结果。
 * 规则返回的错误使整体失败。候选数据必须可重复读取。
 * 本执行器只识别相同条件及其反条件，不推断不同条件之间的领域约束。
 * 最坏路径数仍为指数级，几何匹配、候选排序等应在执行前完成并缓存。
 */
export function 推导动态分析<T extends object>(
  分析: (环境: 分析执行环境) => Result<T | undefined, Error>,
): Result<优先表<T>, Error> {
  type 节点 =
    | { 类型: "结果"; 结果: T; 完整: true }
    | { 类型: "空"; 完整: false }
    | { 类型: "分支"; 条件: 条件; 成立: 节点; 不成立: 节点; 完整: boolean };
  const 空: 节点 = { 类型: "空", 完整: false };
  const { 缓存 } = 创建静态分析环境(() => false);
  let 根: 节点 = 空;
  const 分支列表: Extract<节点, { 类型: "分支" }>[] = [];
  const 待执行: { 条件列表: 条件[]; 写入: (节点: 节点) => void }[] = [
    {
      条件列表: [],
      写入: (节点) => {
        根 = 节点;
      },
    },
  ];
  while (待执行.length) {
    const { 条件列表, 写入 } = 待执行.pop()!;
    const 环境 = 创建静态分析环境((条件) => {
      const 已知 = 条件列表.find(
        (x) => x.element === 条件.element && isEqual(x.value, 条件.value),
      );
      if (已知) return 已知.op === 条件.op;
      throw new 待决条件(条件);
    });
    环境.缓存 = 缓存;
    try {
      const 结果 = 分析(环境);
      if (!结果.ok) return 结果;
      if (结果.value !== undefined) {
        写入({ 类型: "结果", 结果: 结果.value, 完整: true });
      }
    } catch (信号) {
      if (信号 instanceof 待决条件) {
        const 分支: Extract<节点, { 类型: "分支" }> = {
          类型: "分支",
          条件: 信号.条件,
          成立: 空,
          不成立: 空,
          完整: false,
        };
        写入(分支);
        分支列表.push(分支);
        待执行.push(
          {
            条件列表: [...条件列表, 取反(信号.条件)],
            写入: (节点) => {
              分支.不成立 = 节点;
            },
          },
          {
            条件列表: [...条件列表, 信号.条件],
            写入: (节点) => {
              分支.成立 = 节点;
            },
          },
        );
      } else if (!(信号 instanceof 无分析结果)) {
        throw 信号;
      }
    }
  }
  // 子节点总在父节点之后创建，倒序即可求出各子树是否覆盖所有路径。
  for (const 分支 of 分支列表.reverse()) {
    分支.完整 = 分支.成立.完整 && 分支.不成立.完整;
  }
  const 结果列表: 带条件<T>[] = [];
  const 待输出: { 节点: 节点; 条件列表: 条件[] }[] = [
    { 节点: 根, 条件列表: [] },
  ];
  while (待输出.length) {
    const { 节点, 条件列表 } = 待输出.pop()!;
    if (节点.类型 === "结果") {
      结果列表.push({ ...节点.结果, 条件列表 });
    } else if (节点.类型 === "分支") {
      待输出.push(
        {
          节点: 节点.不成立,
          条件列表: 节点.成立.完整 ? 条件列表 : [...条件列表, 取反(节点.条件)],
        },
        { 节点: 节点.成立, 条件列表: [...条件列表, 节点.条件] },
      );
    }
  }
  return ok(new 优先表(结果列表));
}
