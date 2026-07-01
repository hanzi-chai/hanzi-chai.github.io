import { isEqual } from "lodash-es";
import { 图形盒子 } from "./affine.js";
import { type 分类器, 合并分类器 } from "./classifier.js";
import { 部件, 默认退化配置 } from "./component.js";
import { 复合体 } from "./compound.js";
import type { 分析配置, 条件, 退化配置 } from "./config.js";
import type { 旧复合体数据 } from "./data.js";
import { 二笔, type 元素, 笔画 } from "./element.js";
import type { 原始字库 } from "./primitive.js";
import { 获取注册表 } from "./registry.js";
import { type 筛选器, 默认筛选器列表 } from "./selector.js";
import { 字符 } from "./unicode.js";
import {
  ok,
  type Result,
  type 强类型决策,
  type 强类型决策空间,
  type 强类型安排,
  type 强类型安排描述,
} from "./utils.js";

export type 字形 = 部件 | 复合体;

export function 是部件(字形: 字形): 字形 is 部件 {
  return 字形 instanceof 部件;
}

export function 是复合体(字形: 字形): 字形 is 复合体 {
  return 字形 instanceof 复合体;
}

export type 字根 = 笔画 | 二笔 | 部件;

interface 基本部件分析 {
  类型: "部件";
  字根序列: 字根[];
  部件: 部件;
}

export type 带条件<T extends object> = T & {
  条件列表: 条件[];
};

export const 存在 = (x: 字根): 条件 => ({
  element: x.获取名称(),
  op: "不是" as const,
  value: null,
});

interface 基本复合体分析 {
  类型: "复合体";
  字根序列: 字根[];
  复合体: 复合体;
}

type 基本分析 = 基本部件分析 | 基本复合体分析;

interface 字形分析结果<
  部件分析 extends 基本部件分析 = 基本部件分析,
  复合体分析 extends 基本复合体分析 = 基本复合体分析,
> {
  分析结果: Map<字符, (部件分析 | 复合体分析)[]>;
  字根部件列表: 部件[];
}

interface 动态字形分析结果<
  部件分析 extends 基本部件分析 = 基本部件分析,
  复合体分析 extends 基本复合体分析 = 基本复合体分析,
> {
  分析结果: Map<字符, (优先表<部件分析> | 优先表<复合体分析>)[]>;
  字根部件列表: 部件[];
}

interface 字形分析基本配置 {
  分析配置: 分析配置;
  决策: 强类型决策;
  决策空间: 强类型决策空间;
  线性化决策: Map<元素, string>;
  自定义分析映射: Map<部件, (字符 | 笔画 | 二笔)[]>;
  动态自定义分析映射: Map<部件, (字符 | 笔画 | 二笔)[][]>;
  字形来源列表: string[];
}

interface 字形分析配置 {
  决策: 强类型决策;
  决策空间: 强类型决策空间;
  线性化决策: Map<元素, string>;
  字根决策: Map<字根, 强类型安排>;
  字根决策空间: Map<字根, 强类型安排描述[]>;
  可选字根: Set<字根>;
  分类器: 分类器; // 已经填充过默认值
  部件字根列表: 部件[];
  复合体字根映射: Map<复合体, 部件>;
  自定义分析映射: Map<部件, 字根[]>;
  动态自定义分析映射: Map<部件, 字根[][]>;
  退化配置: 退化配置;
  筛选器列表: [string, 筛选器][];
  强字根列表: 字根[];
  弱字根列表: 字根[];
}

export class 优先表<T extends object> {
  constructor(private 列表: 带条件<T>[]) {}

  [Symbol.iterator]() {
    return this.列表[Symbol.iterator]();
  }
}

type 内部带条件 = { 条件列表: 条件[]; 排除: 条件[]; array: object[] };

function 预处理优先表(列表: 带条件<object>[]): 内部带条件[] {
  return 列表.map((entry, i) => {
    const 排除: 条件[] = [];
    for (let j = 0; j < i; j++) {
      const 差集 = 列表[j]!.条件列表.filter(
        (c) => !entry.条件列表.some((e) => isEqual(c, e)),
      );
      if (差集.length === 1 && !排除.some((e) => isEqual(e, 差集[0]!))) {
        排除.push(差集[0]!);
      }
    }
    return { ...entry, 排除, array: [entry] };
  });
}

export function 贝叶斯推断<Ts extends object[], U extends object>(
  优先表列表: { [K in keyof Ts]: 带条件<Ts[K] & object>[] },
  reducer: (a: Ts) => U,
): 带条件<U>[] {
  const recurse = (l: 带条件<object>[][]): 内部带条件[] => {
    if (l.length === 1) return 预处理优先表(l[0]!);
    const 前一个表 = recurse(l.slice(0, -1));
    const 当前表 = 预处理优先表(l.at(-1)!);
    const 结果列表: 内部带条件[] = [];
    for (const 前一个项 of 前一个表) {
      for (const 当前项 of 当前表) {
        const 合并负 = [...前一个项.排除, ...当前项.排除];
        const 合并正 = [...前一个项.条件列表, ...当前项.条件列表];
        if (合并正.some((c) => 合并负.some((e) => isEqual(c, e)))) continue;
        const 扩充条件列表 = [...前一个项.条件列表];
        const 合并项: 内部带条件 = {
          array: [...前一个项.array, ...当前项.array],
          条件列表: 扩充条件列表,
          排除: 合并负,
        };
        if (蕴含(前一个项.条件列表, 当前项.条件列表)) {
          结果列表.push(合并项);
          break;
        } else {
          for (const 条件 of 当前项.条件列表) {
            if (!扩充条件列表.some((c) => isEqual(c, 条件))) {
              扩充条件列表.push(条件);
            }
          }
          结果列表.push(合并项);
        }
      }
    }
    return 结果列表;
  };
  const 结果列表 = recurse(优先表列表 as 带条件<object>[][]).map((x) => ({
    ...reducer(x.array as Ts),
    条件列表: x.条件列表,
  }));
  return 结果列表;
}

function 蕴含(已有列表: 条件[], 目标列表: 条件[]): boolean {
  for (const 目标 of 目标列表) {
    if (!已有列表.some((条件) => isEqual(条件, 目标))) {
      return false;
    }
  }
  return true;
}

class 字库 {
  private repertoire: Map<字符, 字形[]>;

  constructor(repertoire: Map<字符, 字形[]> = new Map()) {
    this.repertoire = repertoire;
  }

  *[Symbol.iterator](): Iterator<{ 字符: 字符; 字形列表: 字形[] }> {
    for (const [字符, 字形列表] of this.repertoire) {
      yield { 字符, 字形列表 };
    }
  }

  查询字形(character: 字符): 字形[] | undefined {
    return this.repertoire.get(character);
  }

  添加(character: 字符, 字形列表: 字形[]) {
    this.repertoire.set(character, 字形列表);
  }

  找到部件(key: string, 原始字库: 原始字库): 部件 | undefined {
    let 汉字字符串 = key,
      索引 = 0;
    if (key.includes("-")) {
      汉字字符串 = key.split("-")[0] ?? "";
      索引 = parseInt(key.split("-")[1] ?? "", 10);
    }
    const 字符 = 原始字库.校验(汉字字符串)?.character;
    if (!字符) return;
    const 字形列表 = (this.查询字形(字符) ?? []).filter(
      (x) => x instanceof 部件,
    ) as 部件[];
    return 字形列表[索引];
  }

  准备字形分析配置(
    分析配置: 分析配置,
    决策: 强类型决策,
    决策空间: 强类型决策空间,
    线性化决策: Map<元素, string>,
    自定义分析映射: Map<部件, (字符 | 笔画 | 二笔)[]>,
    动态自定义分析映射: Map<部件, (字符 | 笔画 | 二笔)[][]>,
  ): Result<字形分析配置, Error> {
    const 字根决策 = new Map<字根, 强类型安排>();
    const 字根决策空间 = new Map<字根, 强类型安排描述[]>();
    const 可选字根 = new Set<字根>();
    const 分类器 = 合并分类器(分析配置.classifier);
    const 全部元素 = new Set<元素>([...决策.keys(), ...决策空间.keys()]);
    const 部件字根列表: 部件[] = [];
    const 复合体字根映射: Map<复合体, 部件> = new Map();
    for (const 元素 of 全部元素) {
      const 安排 = 决策.get(元素);
      const 安排列表 = 决策空间.get(元素) ?? [];
      const 所有字根: 字根[] = [];
      if (元素 instanceof 笔画 || 元素 instanceof 二笔) {
        所有字根.push(元素);
      } else if (元素 instanceof 字符) {
        const 字形列表 = this.查询字形(元素) ?? [];
        for (const 字根字形 of 字形列表) {
          if (字根字形 instanceof 部件) {
            部件字根列表.push(字根字形);
            所有字根.push(字根字形);
          } else {
            const 图形盒子 = this.递归渲染复合体(字根字形);
            if (!图形盒子.ok) return 图形盒子;
            const 真部件 = new 部件(
              元素,
              字根字形.标签集合,
              字根字形.兼容,
              图形盒子.value.获取笔画列表(),
            );
            部件字根列表.push(真部件);
            复合体字根映射.set(字根字形, 真部件);
            所有字根.push(真部件);
          }
        }
      }
      for (const 字根 of 所有字根) {
        字根决策空间.set(字根, 安排列表);
        if (安排) 字根决策.set(字根, 安排);
        if (安排 === undefined || 安排列表?.some((x) => x.value == null)) {
          可选字根.add(字根);
        }
      }
    }
    const 全部字根 = [...字根决策空间.keys()];
    const 新自定义分析映射 = new Map<部件, 字根[]>();
    const 新动态自定义分析映射 = new Map<部件, 字根[][]>();
    for (const [部件实例, 元素列表] of 自定义分析映射) {
      const 字根列表: 字根[] = [];
      for (const 元素 of 元素列表) {
        if (元素 instanceof 笔画 || 元素 instanceof 二笔) 字根列表.push(元素);
        else {
          const 字根 = 全部字根.find(
            (x) => x instanceof 部件 && x.字符 === 元素,
          );
          if (字根) 字根列表.push(字根);
        }
      }
      新自定义分析映射.set(部件实例, 字根列表);
    }
    for (const [部件实例, 元素列表列表] of 动态自定义分析映射) {
      const 字根列表列表: 字根[][] = [];
      for (const 元素列表 of 元素列表列表) {
        const 字根列表: 字根[] = [];
        for (const 元素 of 元素列表) {
          if (元素 instanceof 笔画 || 元素 instanceof 二笔) 字根列表.push(元素);
          else {
            const 字根 = 全部字根.find(
              (x) => x instanceof 部件 && x.字符 === 元素,
            );
            if (字根) 字根列表.push(字根);
          }
        }
        字根列表列表.push(字根列表);
      }
      新动态自定义分析映射.set(部件实例, 字根列表列表);
    }
    const 字根名称映射 = new Map(
      [...字根决策.keys()].map((x) => [x.获取名称(), x] as const),
    );
    const 筛选器列表: [string, 筛选器][] = [];
    for (const name of 分析配置.selector ?? 默认筛选器列表) {
      const 筛选器 = 获取注册表().创建筛选器(name);
      if (筛选器) {
        筛选器列表.push([name, 筛选器]);
      }
    }
    const 强字根列表: 字根[] = [];
    for (const name of 分析配置.strong ?? []) {
      const 字根 = 字根名称映射.get(name);
      if (字根) 强字根列表.push(字根);
    }
    const 弱字根列表: 字根[] = [];
    for (const name of 分析配置.weak ?? []) {
      const 字根 = 字根名称映射.get(name);
      if (字根) 弱字根列表.push(字根);
    }
    return ok({
      决策,
      决策空间,
      线性化决策,
      退化配置: 分析配置.degenerator ?? 默认退化配置,
      筛选器列表,
      分类器,
      字根决策,
      字根决策空间,
      可选字根,
      部件字根列表,
      复合体字根映射,
      自定义分析映射: 新自定义分析映射,
      动态自定义分析映射: 新动态自定义分析映射,
      强字根列表,
      弱字根列表,
    });
  }

  /**
   * 确定需要分析的字符
   */
  获取待分析部件(汉字列表: Set<字符>) {
    const 待分析部件集合: Set<部件> = new Set();
    const recurse = (glyph: 字形) => {
      if (是部件(glyph)) 待分析部件集合.add(glyph);
      else {
        for (const 子字形 of glyph.部分列表) {
          recurse(子字形);
        }
      }
    };
    for (const 汉字 of 汉字列表) {
      const 字形列表 = this.查询字形(汉字) ?? [];
      for (const 字形 of 字形列表) {
        recurse(字形);
      }
    }
    return 待分析部件集合;
  }

  /**
   * 将复合体递归渲染为 SVG 图形
   *
   * @param 复合体 - 复合体
   * @param repertoire - 原始字符集
   *
   * @returns SVG 图形或错误
   */
  递归渲染复合体(复合体: 复合体): Result<图形盒子, Error> {
    const 图形盒子列表: 图形盒子[] = [];
    for (const 部分 of 复合体.部分列表) {
      if (部分 instanceof 部件) {
        const 盒子 = 图形盒子.从笔画列表构建(部分.矢量图形);
        图形盒子列表.push(盒子);
      } else {
        const rendered = this.递归渲染复合体(部分);
        if (!rendered.ok) return rendered;
        图形盒子列表.push(rendered.value);
      }
    }
    return ok(
      图形盒子.仿射合并(
        {
          type: "compound",
          operator: 复合体.结构描述字符,
          order: 复合体.笔顺,
        } as 旧复合体数据,
        图形盒子列表,
      ),
    );
  }

  准备分析(base: 字形分析基本配置, 汉字集合: Set<字符>) {
    const {
      分析配置,
      决策,
      决策空间,
      线性化决策,
      自定义分析映射,
      动态自定义分析映射,
    } = base;
    const 如配置 = this.准备字形分析配置(
      分析配置,
      决策,
      决策空间,
      线性化决策,
      自定义分析映射,
      动态自定义分析映射,
    );
    if (!如配置.ok) return 如配置;
    const 配置 = 如配置.value;
    const 待分析部件集合 = this.获取待分析部件(汉字集合);
    const 部件分析器 = 获取注册表().创建部件分析器(
      分析配置.component_analyzer || "默认",
      配置,
    )!;
    const 复合体分析器 = 获取注册表().创建复合体分析器(
      分析配置.compound_analyzer || "默认",
      配置,
    )!;
    return ok({
      待分析部件集合,
      部件分析器,
      复合体分析器,
      字根部件列表: 配置.部件字根列表,
      复合体字根映射: 配置.复合体字根映射,
    });
  }

  /**
   * 对整个字符集中的字符进行拆分
   *
   * @param repertoire - 字符集
   * @param config - 配置
   */
  分析(
    base: 字形分析基本配置,
    汉字集合: Set<字符>,
  ): Result<字形分析结果, Error> {
    const 分析配置或错误 = this.准备分析(base, 汉字集合);
    if (!分析配置或错误.ok) return 分析配置或错误;
    const 分析配置 = 分析配置或错误.value;
    const 部件分析结果 = new Map<部件, 基本部件分析>();
    for (const 部件 of 分析配置.待分析部件集合) {
      const 分析 = 分析配置.部件分析器.分析(部件);
      if (!分析.ok) return 分析;
      部件分析结果.set(部件, 分析.value);
    }
    // 对冰雪飞花，把从复合体转出的部件也分析一下
    // if (base.分析配置.component_analyzer === "冰雪飞花") {
    //   for (const [_, 部件] of 分析配置.复合体字根映射) {
    //     const 分析 = 分析配置.部件分析器.分析(部件);
    //     if (!分析.ok) return 分析;
    //     部件分析结果.set(部件, 分析.value);
    //   }
    // }
    分析配置.复合体分析器.部件分析结果 = 部件分析结果;
    const 分析结果 = new Map<字符, 基本分析[]>();
    for (const 字符 of 汉字集合) {
      const 结果列表: 基本分析[] = [];
      const 字形列表 = this.查询字形(字符) ?? [];
      for (const 字形 of 字形列表) {
        if (字形 instanceof 部件) {
          const 分析 = 部件分析结果.get(字形)!;
          结果列表.push(分析);
        } else {
          const 分析 = 分析配置.复合体分析器.分析(字形);
          if (!分析.ok) return 分析;
          结果列表.push(分析.value);
        }
      }
      分析结果.set(字符, 结果列表);
    }
    for (const [部件, 分析] of 部件分析结果) {
      if (!汉字集合.has(部件.字符)) {
        分析结果.set(部件.字符, (分析结果.get(部件.字符) ?? []).concat([分析]));
      }
    }
    return ok({
      分析结果,
      字根部件列表: 分析配置.字根部件列表,
    });
  }

  /**
   * 对整个字符集中的字符进行拆分
   *
   * @param repertoire - 字符集
   * @param config - 配置
   */
  动态分析(
    base: 字形分析基本配置,
    汉字集合: Set<字符>,
  ): Result<动态字形分析结果, Error> {
    const 分析配置或错误 = this.准备分析(base, 汉字集合);
    if (!分析配置或错误.ok) return 分析配置或错误;
    const 分析配置 = 分析配置或错误.value;
    const 动态部件分析结果 = new Map<部件, 优先表<基本部件分析>>();
    for (const 部件 of 分析配置.待分析部件集合) {
      const 分析 = 分析配置.部件分析器.动态分析(部件);
      if (!分析.ok) return 分析;
      动态部件分析结果.set(部件, 分析.value);
    }
    分析配置.复合体分析器.动态部件分析结果 = 动态部件分析结果;
    const 分析结果 = new Map<
      字符,
      (优先表<基本部件分析> | 优先表<基本复合体分析>)[]
    >();
    for (const 字符 of 汉字集合) {
      const 结果列表: (优先表<基本部件分析> | 优先表<基本复合体分析>)[] = [];
      const 字形列表 = this.查询字形(字符) ?? [];
      for (const 字形 of 字形列表) {
        if (字形 instanceof 部件) {
          const 分析 = 动态部件分析结果.get(字形)!;
          结果列表.push(分析);
        } else {
          const 分析 = 分析配置.复合体分析器.动态分析(字形);
          if (!分析.ok) return 分析;
          结果列表.push(分析.value);
        }
      }
      分析结果.set(字符, 结果列表);
    }
    return ok({
      分析结果,
      字根部件列表: 分析配置.字根部件列表,
    });
  }
}

export type {
  动态字形分析结果,
  基本分析,
  基本复合体分析,
  基本部件分析,
  字形分析结果,
  字形分析配置,
};
export { 字库 };
