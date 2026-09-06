import { max } from "lodash-es";
import { type 分类器, 合并分类器 } from "./classifier.js";
import { type 基本部件分析, 部件, 默认退化配置 } from "./component.js";
import type { 基本复合体分析 } from "./compound.js";
import { 复合体 } from "./compound.js";
import type {
  分析配置,
  字形拼写运算,
  字形自定义,
  字集指示,
  模式,
  补丁操作,
  退化配置,
} from "./config.js";
import type {
  基本字形数据,
  字形来源数据,
  字符数据,
  结构描述字符,
} from "./data.js";
import { 二笔, type 元素, 笔画, 自定义元素 } from "./element.js";
import { 获取注册表 } from "./registry.js";
import { type 筛选器, 默认筛选器列表 } from "./selector.js";
import { 字符, 字集过滤查找表 } from "./unicode.js";
import {
  ok,
  type Result,
  优先表,
  type 原始词典,
  type 字根,
  type 字根元素,
  type 强类型决策,
  type 强类型决策空间,
  type 强类型安排,
  type 强类型安排描述,
  type 自定义分析,
  type 自定义分析映射,
  type 词典,
  部件字根,
} from "./utils.js";

// 模式变量映射：记录模式匹配过程中变量的绑定
interface 模式变量映射 {
  id映射: Map<number, number>; // variable -> glyph id
  operator映射: Map<number, 结构描述字符>; // variable -> operator
}

type 字形单一来源数据 = { id: number; source?: string };

export interface 扩展字符数据 extends 字符数据 {
  character: 字符;
  expanded_glyphs: 字形单一来源数据[];
  expanded_glyphs_history: 字形单一来源数据[][];
  final_extended_glyphs: 字形单一来源数据[];
  final_glyphs: 字形来源数据[];
}

type 字符数据单一补丁 = 补丁操作 & {
  source?: string;
};

export type 字形 = 部件 | 复合体;

export function 是部件(字形: 字形): 字形 is 部件 {
  return 字形 instanceof 部件;
}

export function 是复合体(字形: 字形): 字形 is 复合体 {
  return 字形 instanceof 复合体;
}

type 基本分析 = 基本部件分析 | 基本复合体分析;

export interface 来源和兼容标记 {
  sources: string[];
}

export type 基本字符字形分析 = 基本分析 & 来源和兼容标记;

interface 字形分析结果<
  部件分析 extends 基本部件分析 = 基本部件分析,
  复合体分析 extends 基本复合体分析 = 基本复合体分析,
> {
  分析结果: Map<字符, ((部件分析 | 复合体分析) & 来源和兼容标记)[]>;
  部件分析结果: Map<部件, 部件分析>;
  复合体分析结果: Map<复合体, 复合体分析>;
  字根部件列表: 部件字根[];
}

interface 动态字形分析结果<
  部件分析 extends 基本部件分析 = 基本部件分析,
  复合体分析 extends 基本复合体分析 = 基本复合体分析,
> {
  分析结果: Map<字符, (优先表<部件分析> | 优先表<复合体分析>)[]>;
  部件分析结果: Map<部件, 优先表<部件分析>>;
  复合体分析结果: Map<复合体, 优先表<复合体分析>>;
  字根部件列表: 部件字根[];
}

interface 字形分析基本配置 {
  分析配置: 分析配置;
  决策: 强类型决策;
  决策空间: 强类型决策空间;
  线性化决策: Map<元素, string>;
  自定义分析映射: Map<部件, 字根元素[]>;
  动态自定义分析映射: Map<部件, 字根元素[][]>;
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
  部件字根列表: 部件字根[];
  复合体字根映射: Map<复合体, 部件字根>;
  自定义分析映射: Map<部件, 字根[]>;
  动态自定义分析映射: Map<部件, 字根[][]>;
  退化配置: 退化配置;
  筛选器列表: [string, 筛选器][];
  强字根列表: 字根[];
  弱字根列表: 字根[];
}

/**
 * 字形库：解引用并构建所有字形（部件/复合体），并应用拼写运算。
 *
 * 新合成的字形使用占位符 ID。
 * 字符数据变化时无需重建字形库，可复用同一实例。
 */
class 字形库 {
  private 字形表: Map<number, 字形>;
  private 字形查找表: Map<number, 基本字形数据>;

  constructor(
    字形数据列表: 基本字形数据[],
    拼写运算列表: 字形拼写运算[] = [],
  ) {
    this.字形表 = new Map();
    this.字形查找表 = new Map();
    // 新字形 ID 分配器
    let 新ID计数器 = max(字形数据列表.map((x) => x.id))! + 1; // 占位符 ID 起始值
    const 取新ID = () => {
      if (新ID计数器 > 0x1_ffff) {
        throw new Error("新字形 ID 超过范围");
      }
      return 新ID计数器++;
    };

    // 处理所有字形
    字形数据列表.map((glyph) => this.字形查找表.set(glyph.id, glyph));
    for (const [id, _] of this.字形查找表) {
      this.构建并变换字形(id, 拼写运算列表, 取新ID);
    }
  }

  *字形迭代器() {
    for (const [id, 字形实例] of this.字形表) {
      yield [id, 字形实例] as const;
    }
  }

  获取字形(id: number): 字形 | undefined {
    return this.字形表.get(id);
  }

  存在原始字形(id: number): boolean {
    return this.字形查找表.has(id);
  }

  /**
   * 递归构建字形树，并应用拼写运算。
   * @param id 当前字形 ID
   * @param 拼写运算列表 拼写运算列表
   * @param 取新ID 分配新字形 ID 的函数
   * @param 最大深度 最大递归深度，防止循环引用
   * @returns 构建好的字形实例
   */
  private 构建并变换字形(
    id: number,
    拼写运算列表: 字形拼写运算[],
    取新ID: () => number,
    最大深度 = 10,
  ): 字形 {
    const 字形数据 = this.字形查找表.get(id);
    if (!字形数据) {
      throw new Error(`字形 ${id} 不存在于字形查找表中`);
    }
    const 已存在 = this.字形表.get(字形数据.id);
    if (已存在) return 已存在;
    if (字形数据.type === "component") {
      const 当前字形 = new 部件(字形数据);
      this.字形表.set(当前字形.id, 当前字形);
      return 当前字形;
    }
    if (最大深度 <= 0) {
      throw new Error("解引用超过最大深度，可能存在循环引用");
    }
    const 子字形列表: 字形[] = [];
    for (const { id } of 字形数据.references) {
      if (!this.字形查找表.has(id)) {
        throw new Error(`子字形 ${id} 不存在于字形查找表中`);
      }
      const 子字形 = this.构建并变换字形(
        id,
        拼写运算列表,
        取新ID,
        最大深度 - 1,
      );
      子字形列表.push(子字形);
    }
    const 原始字形 = new 复合体(字形数据, 子字形列表);
    // 尝试应用拼写运算列表，匹配 from 模式并执行 to 模式的增删改
    const 模式变量映射: 模式变量映射 = {
      id映射: new Map(),
      operator映射: new Map(),
    };
    let 当前字形: 字形 = 原始字形;
    for (const { from, to } of 拼写运算列表) {
      if (this.匹配模式(当前字形, from, 模式变量映射)) {
        const 新字形 = this.合成字形(
          to,
          模式变量映射,
          拼写运算列表,
          取新ID,
          最大深度 - 1,
        );
        if (新字形) {
          当前字形 = 新字形;
        }
      }
    }
    this.字形表.set(当前字形.id, 当前字形);
    return 当前字形;
  }

  /**
   * 在字形树上进行模式匹配。
   * 返回 true 表示匹配成功，同时将变量绑定写入映射。
   */
  private 匹配模式(字形: 字形, 模式: 模式, 映射: 模式变量映射): boolean {
    // ID：精确匹配字形 ID
    if (typeof 模式 === "number") {
      return 字形.id === 模式;
    }
    // IDVariable：匹配字形 ID（可选限定 id_set），绑定变量
    if (!("references" in 模式)) {
      const { variable, id_set } = 模式;
      if (id_set && !id_set.includes(字形.id)) return false;
      const bound = 映射.id映射.get(variable);
      if (bound !== undefined) return bound === 字形.id;
      映射.id映射.set(variable, 字形.id);
      return true;
    }
    // 复合模式：匹配复合体树数据
    if (字形 instanceof 部件) return false;
    const { operator, references } = 模式;
    // 匹配结构描述字符
    if (typeof operator === "string") {
      if (字形.结构描述字符 !== operator) return false;
    } else {
      // OperatorVariable
      const { variable, opearator_set } = operator;
      if (opearator_set && !opearator_set.includes(字形.结构描述字符))
        return false;
      const bound = 映射.operator映射.get(variable);
      if (bound !== undefined) return bound !== 字形.结构描述字符;
      映射.operator映射.set(variable, 字形.结构描述字符);
    }
    // 匹配子节点
    if (references.length !== 字形.部分列表.length) return false;
    for (const [i, ref] of references.entries()) {
      const 子字形 = 字形.部分列表[i]!;
      if (!this.匹配模式(子字形, ref, 映射)) return false;
    }
    return true;
  }

  /**
   * 根据 to 模式和变量绑定合成新的已解引用字形。
   * 新字形使用取新ID()分配的占位符 ID。
   */
  private 合成字形(
    模式: 模式,
    映射: 模式变量映射,
    拼写运算列表: 字形拼写运算[],
    取新ID: () => number,
    最大深度 = 10,
  ): 字形 | undefined {
    // ID：直接查表返回
    if (typeof 模式 === "number") {
      if (!this.字形查找表.has(模式)) return undefined;
      return this.构建并变换字形(模式, 拼写运算列表, 取新ID, 最大深度 - 1);
    }
    // IDVariable：根据变量绑定查找对应的字形
    if (!("references" in 模式)) {
      const glyphId = 映射.id映射.get(模式.variable);
      if (glyphId === undefined) return undefined;
      if (!this.字形查找表.has(glyphId)) return undefined;
      return this.构建并变换字形(glyphId, 拼写运算列表, 取新ID, 最大深度 - 1);
    }
    // 复合模式：递归合成新的字形
    const { operator, references } = 模式;
    // 解析结构描述字符
    let 已解析Operator: 结构描述字符;
    if (typeof operator === "string") {
      已解析Operator = operator;
    } else {
      const op = 映射.operator映射.get(operator.variable);
      if (!op) return undefined;
      已解析Operator = op;
    }
    // 递归合成子节点
    const 子字形列表: 字形[] = [];
    for (const 子模式 of references) {
      const 子字形 = this.合成字形(子模式, 映射, 拼写运算列表, 取新ID, 最大深度 - 1);
      if (!子字形) return undefined;
      子字形列表.push(子字形);
    }
    return new 复合体(
      {
        type: "compound",
        id: 取新ID(),
        operator: 已解析Operator,
        references: 子字形列表.map((glyph) => ({ id: glyph.id })),
        ambiguous: false,
      },
      子字形列表,
    );
  }
}

/**
 * 确定每个字符的最终字形列表。
 *
 * 流程：
 * 1. 解引用字形查找表中的所有字形（由字形库完成）
 * 2. 针对每个字符，依次应用拼写运算，匹配 from 模式并执行增删改
 * 3. 将变更累积到字形自定义（补丁）中
 * 4. 返回新的字形查找表和字符查找表
 */
class 字库 {
  private 字形库: 字形库;
  private 字符表: Map<number, 扩展字符数据>;

  constructor(
    字符数据列表: 字符数据[],
    字形库: 字形库,
    字形来源列表: string[],
    字形自定义: 字形自定义 = {},
  ) {
    this.字形库 = 字形库;
    this.字符表 = new Map();

    // 处理所有字符
    for (const data of 字符数据列表) {
      const 字符实例 = 字符.从码位创建(data.unicode);
      if (!字符实例.ok) continue;
      const glyphs: 字形单一来源数据[] = [];
      for (const 来源数据 of data.glyphs) {
        for (const source of 来源数据.sources) {
          glyphs.push({ id: 来源数据.id, source });
        }
        // 对于非 unified 字符，只有一个字形，source 定义为 undefined
        if (来源数据.sources.length === 0) {
          glyphs.push({ id: 来源数据.id });
        }
      }
      this.字符表.set(data.unicode, {
        ...data,
        character: 字符实例.value,
        expanded_glyphs: glyphs,
        expanded_glyphs_history: [glyphs],
        final_extended_glyphs: [],
        final_glyphs: [],
      });
    }

    // 5. 对每个字符应用字形自定义补丁
    for (const [字符串, 补丁列表] of Object.entries(字形自定义)) {
      const 字符数据 = this.校验字符(字符串);
      if (!字符数据) continue;
      const 单一补丁列表: 字符数据单一补丁[] = [];
      for (const 补丁 of 补丁列表) {
        const { sources, ...rest } = 补丁;
        for (const source of 补丁.sources) {
          单一补丁列表.push({ ...rest, source });
        }
        if (补丁.sources.length === 0) {
          单一补丁列表.push({ ...rest });
        }
      }
      for (const 补丁 of 单一补丁列表) {
        const prev = 字符数据.expanded_glyphs_history.at(-1) ?? [];
        let next: 字形单一来源数据[];
        switch (补丁.type) {
          case "delete": {
            next = prev.filter((来源数据) => 来源数据.source !== 补丁.source);
            break;
          }
          case "update": {
            if (!this.字形库.存在原始字形(补丁.id)) continue;
            next = prev.map((来源数据) =>
              来源数据.source === 补丁.source
                ? { id: 补丁.id, source: 来源数据.source }
                : 来源数据,
            );
            break;
          }
          case "insert": {
            if (!this.字形库.存在原始字形(补丁.id)) continue;
            next = [...prev, { id: 补丁.id, source: 补丁.source }];
            break;
          }
        }
        字符数据.expanded_glyphs_history.push(next);
      }
    }

    for (const 字形历史 of this.字符表.values()) {
      const last = 字形历史.expanded_glyphs_history.at(-1) ?? [];
      字形历史.final_extended_glyphs = last.filter(
        (x) => x.source === undefined || 字形来源列表.includes(x.source),
      );
      const groupById = new Map<number, Set<string | undefined>>();
      for (const { id, source } of 字形历史.final_extended_glyphs) {
        if (!groupById.has(id)) {
          groupById.set(id, new Set());
        }
        groupById.get(id)!.add(source);
      }
      for (const [id, sources] of groupById) {
        字形历史.final_glyphs.push({
          id,
          sources: Array.from(sources).filter(
            (s) => s !== undefined,
          ) as string[],
        });
      }
    }
  }

  *[Symbol.iterator]() {
    for (const [字符实例, 历史记录] of this.字符表) {
      yield [字符实例, 历史记录] as const;
    }
  }

  *字形迭代器() {
    yield* this.字形库.字形迭代器();
  }

  查询字符的字形(字符: 字符): 字形[] | undefined {
    const 字形信息列表 = this.字符表.get(字符.toNumber())?.final_glyphs;
    if (!字形信息列表) return undefined;
    const 字形列表: 字形[] = [];
    for (const 字形数据 of 字形信息列表) {
      const 字形实例 = this.字形库.获取字形(字形数据.id);
      if (字形实例) {
        字形列表.push(字形实例);
      }
    }
    return 字形列表;
  }

  获取字形(id: number): 字形 | undefined {
    return this.字形库.获取字形(id);
  }

  查询字符(字符实例: 字符): 扩展字符数据 | undefined {
    return this.字符表.get(字符实例.toNumber());
  }

  校验字符(汉字: string): 扩展字符数据 | undefined {
    const 字符列表 = [...汉字];
    if (字符列表.length !== 1) return;
    return this.字符表.get(汉字.codePointAt(0)!);
  }

  校验自定义映射(自定义元素集合: Record<string, 自定义分析>) {
    const 自定义分析映射: 自定义分析映射 = new Map();
    const 自定义元素映射 = new Map<string, 自定义元素[]>();
    for (const [类别, 映射] of Object.entries(自定义元素集合)) {
      const 元素名称映射 = new Map<string, 自定义元素>();
      for (const [汉字, 元素名称列表] of Object.entries(映射)) {
        const 字符实例 = this.校验字符(汉字);
        if (!字符实例) continue;
        const 记录 =
          自定义分析映射.get(字符实例.character) ??
          new Map<string, 自定义元素[]>();
        const 元素列表: 自定义元素[] = [];
        for (const 元素名称 of 元素名称列表) {
          const 元素 =
            元素名称映射.get(元素名称) ?? new 自定义元素(类别, 元素名称);
          元素列表.push(元素);
          if (!元素名称映射.has(元素名称)) 元素名称映射.set(元素名称, 元素);
        }
        记录.set(类别, 元素列表);
        自定义分析映射.set(字符实例.character, 记录);
      }
      自定义元素映射.set(类别, [...元素名称映射.values()]);
    }
    return { 自定义分析映射, 自定义元素映射 };
  }

  校验词典(原始词典: 原始词典): 词典 {
    const result: 词典 = [];
    for (const { 词, ...rest } of 原始词典) {
      const 字符列表: 字符[] = [];
      let valid = true;
      for (const 字符 of [...词]) {
        const 字符实例 = this.校验字符(字符)?.character;
        if (字符实例) {
          字符列表.push(字符实例);
        } else {
          valid = false;
        }
      }
      if (valid) result.push({ 词: 字符列表, ...rest });
    }
    return result;
  }

  过滤词典(词典: 词典, 字集指示: 字集指示): 词典 {
    const 过滤函数 = 字集过滤查找表[字集指示]!;
    const result: 词典 = [];
    for (const 条目 of 词典) {
      let valid = true;
      for (const 汉字 of 条目.词) {
        const 汉字数据 = this.查询字符(汉字);
        if (!汉字数据) continue;
        if (!过滤函数(汉字数据.character, 汉字数据)) valid = false;
      }
      if (valid) result.push(条目);
    }
    return result;
  }

  获取汉字集合(词典: 词典): Set<字符> {
    const 字符集合 = new Set<字符>();
    for (const { 词 } of 词典) {
      for (const 汉字 of 词) {
        const 汉字数据 = this.查询字符(汉字);
        if (!汉字数据) continue;
        字符集合.add(汉字);
      }
    }
    return 字符集合;
  }

  准备字形分析配置(
    分析配置: 分析配置,
    决策: 强类型决策,
    决策空间: 强类型决策空间,
    线性化决策: Map<元素, string>,
    自定义分析映射: Map<部件, 字根元素[]>,
    动态自定义分析映射: Map<部件, 字根元素[][]>,
  ): Result<字形分析配置, Error> {
    const 字根决策 = new Map<字根, 强类型安排>();
    const 字根决策空间 = new Map<字根, 强类型安排描述[]>();
    const 可选字根 = new Set<字根>();
    const 分类器 = 合并分类器(分析配置.classifier);
    const 全部元素 = new Set<元素>([...决策.keys(), ...决策空间.keys()]);
    const 部件字根列表: 部件字根[] = [];
    const 复合体字根映射: Map<复合体, 部件字根> = new Map();
    for (const 元素 of 全部元素) {
      const 安排 = 决策.get(元素);
      const 安排列表 = 决策空间.get(元素) ?? [];
      const 所有字根: 字根[] = [];
      if (元素 instanceof 笔画 || 元素 instanceof 二笔) {
        所有字根.push(元素);
      } else if (
        元素 instanceof 字符 ||
        元素 instanceof 部件 ||
        元素 instanceof 复合体
      ) {
        const 字形列表: 字形[] = [];
        if (元素 instanceof 字符) {
          字形列表.push(...(this.查询字符的字形(元素) ?? []));
        } else {
          字形列表.push(元素);
        }
        for (const 字根字形 of 字形列表) {
          if (字根字形 instanceof 部件) {
            const 字根实例 = new 部件字根(元素, 字根字形);
            部件字根列表.push(字根实例);
            所有字根.push(字根实例);
          } else {
            const 部件字形 = new 部件({
              type: "component",
              id: 0,
              strokes: 字根字形.图形盒子.获取笔画列表(),
              operator: undefined,
              references: undefined,
              ambiguous: false,
            });
            const 字根实例 = new 部件字根(元素, 部件字形);
            部件字根列表.push(字根实例);
            复合体字根映射.set(字根字形, 字根实例);
            所有字根.push(字根实例);
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
            (x) => x instanceof 部件字根 && x.元素 === 元素,
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
              (x) => x instanceof 部件字根 && x.元素 === 元素,
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
    console.log(复合体字根映射);
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
  获取待分析部件和复合体集合(汉字列表: Set<字符>) {
    const 待分析部件集合: Set<部件> = new Set();
    const 待分析复合体集合: Set<复合体> = new Set();
    const recurse = (glyph: 字形) => {
      if (是部件(glyph)) 待分析部件集合.add(glyph);
      else {
        for (const 子字形 of glyph.部分列表) {
          recurse(子字形);
        }
      }
    };
    for (const 汉字 of 汉字列表) {
      const 字形列表 = this.查询字符的字形(汉字) ?? [];
      for (const 字形 of 字形列表) {
        recurse(字形);
        if (是复合体(字形)) {
          待分析复合体集合.add(字形);
        }
      }
    }
    return { 待分析部件集合, 待分析复合体集合 };
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
    const { 待分析部件集合, 待分析复合体集合 } =
      this.获取待分析部件和复合体集合(汉字集合);
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
      待分析复合体集合,
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
    const { 部件分析结果 } = 分析配置.复合体分析器;
    const 复合体分析结果 = new Map<复合体, 基本复合体分析>();
    for (const 部件 of 分析配置.待分析部件集合) {
      const 分析 = 分析配置.部件分析器.分析(部件);
      if (!分析.ok) return 分析;
      部件分析结果.set(部件, 分析.value);
    }
    for (const 复合体 of 分析配置.待分析复合体集合) {
      const 分析 = 分析配置.复合体分析器.分析(复合体);
      if (!分析.ok) return 分析;
      复合体分析结果.set(复合体, 分析.value);
    }
    const 分析结果 = new Map<字符, 基本字符字形分析[]>();
    for (const 字符 of 汉字集合) {
      const 字形来源列表 = this.字符表.get(字符.toNumber())?.final_glyphs ?? [];
      const 分析列表: 基本字符字形分析[] = [];
      for (const 字形来源数据 of 字形来源列表) {
        const { id, ...rest } = 字形来源数据;
        const 字形 = this.字形库.获取字形(id);
        if (!字形) continue;
        if (是部件(字形)) {
          const 分析 = 部件分析结果.get(字形);
          if (分析) 分析列表.push({ ...分析, ...rest });
        } else if (是复合体(字形)) {
          const 分析 = 复合体分析结果.get(字形);
          if (分析) 分析列表.push({ ...分析, ...rest });
        }
      }
      分析结果.set(字符, 分析列表);
    }
    return ok({
      分析结果,
      部件分析结果,
      复合体分析结果,
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
    const { 动态部件分析结果 } = 分析配置.复合体分析器;
    const 动态复合体分析结果 = new Map<复合体, 优先表<基本复合体分析>>();
    for (const 部件 of 分析配置.待分析部件集合) {
      const 分析 = 分析配置.部件分析器.动态分析(部件);
      if (!分析.ok) return 分析;
      动态部件分析结果.set(部件, 分析.value);
    }
    for (const 复合体 of 分析配置.待分析复合体集合) {
      const 分析 = 分析配置.复合体分析器.动态分析(复合体);
      if (!分析.ok) return 分析;
      动态复合体分析结果.set(复合体, 分析.value);
    }
    type 分析结果类型 = 优先表<基本部件分析> | 优先表<基本复合体分析>;
    const 分析结果 = new Map<字符, 分析结果类型[]>();
    for (const 汉字 of 汉字集合) {
      const 字形来源列表 = this.字符表.get(汉字.toNumber())?.final_glyphs ?? [];
      const 分析列表: 分析结果类型[] = [];
      for (const { id, ...rest } of 字形来源列表) {
        const 字形 = this.字形库.获取字形(id);
        if (!字形) continue;
        if (是部件(字形)) {
          const 分析 = 动态部件分析结果.get(字形);
          if (分析) 分析列表.push(new 优先表([...分析], rest.sources, false));
        } else if (是复合体(字形)) {
          const 分析 = 动态复合体分析结果.get(字形);
          if (分析) 分析列表.push(new 优先表([...分析], rest.sources, false));
        }
      }
      分析结果.set(汉字, 分析列表);
    }
    return ok({
      分析结果,
      部件分析结果: 动态部件分析结果,
      复合体分析结果: 动态复合体分析结果,
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
export { 字库, 字形库 };
