import type {
  字形拼写运算,
  字形自定义,
  字集指示,
  模式,
  补丁操作,
} from "./config.js";
import type {
  基本字形数据,
  基本部件数据,
  复合体数据,
  字符数据,
  引用数据,
  结构描述字符,
} from "./data.js";
import { 自定义元素 } from "./element.js";
import { 字库 } from "./repertoire.js";
import { 字符, 字集过滤查找表 } from "./unicode.js";
import type { 原始词典, 自定义分析, 自定义分析映射, 词典 } from "./utils.js";

// 模式变量映射：记录模式匹配过程中变量的绑定
interface 模式变量映射 {
  id映射: Map<number, number>; // variable -> glyph id
  operator映射: Map<number, 结构描述字符>; // variable -> operator
}

export interface 校验字符数据 extends 字符数据 {
  character: 字符;
}

type 字形单一来源数据 = { id: number; source: string };

export interface 字形历史记录 {
  original: 字形单一来源数据[];
  steps: 字形单一来源数据[][];
  final: 字形单一来源数据[];
  filtered: 字形单一来源数据[];
}

type 字符数据单一补丁 = 补丁操作 & {
  source: string;
};

interface 解引用数据 extends Omit<引用数据, "id"> {
  glyph: 字形树数据;
}

export interface 复合体树数据 extends Omit<复合体数据, "references"> {
  references: 解引用数据[];
}

export type 字形树数据 = 基本部件数据 | 复合体树数据;

class 原始字库 {
  private 字符表: Map<number, 校验字符数据>;
  private 字形表: Map<number, 基本字形数据>;
  constructor(字符列表: 字符数据[], 字形列表: 基本字形数据[]) {
    this.字符表 = new Map();
    this.字形表 = new Map();
    for (const data of 字符列表) {
      const 字符实例 = 字符.从码位创建(data.unicode);
      if (!字符实例.ok) continue;
      this.字符表.set(data.unicode, { ...data, character: 字符实例.value });
    }
    for (const data of 字形列表) {
      this.字形表.set(data.id, data);
    }
  }

  [Symbol.iterator](): Iterator<校验字符数据> {
    return this.字符表.values();
  }

  查询(字符实例: 字符): 校验字符数据 | undefined {
    return this.字符表.get(字符实例.toNumber());
  }

  校验(汉字: string): 校验字符数据 | undefined {
    const 字符列表 = [...汉字];
    if (字符列表.length !== 1) return;
    return this.字符表.get(汉字.codePointAt(0)!);
  }

  /**
   * 将复合体数据中的字形引用（id）解引用为实际的字形数据，
   * 递归构建一棵有限深度的复合体树。
   *
   * - 基本部件数据（type: "component"）没有引用，直接返回
   * - 复合体数据（type: "compound"）的每个 reference.id
   *   会在字形查找中解析，递归解引用后替换为解引用数据
   */
  private 解引用字形(
    字形: 基本字形数据,
    最大深度 = 10,
  ): 基本部件数据 | 复合体树数据 {
    if (字形.type === "component") {
      return 字形;
    }
    if (最大深度 <= 0) {
      throw new Error("解引用超过最大深度，可能存在循环引用");
    }
    const 已解引用: 解引用数据[] = [];
    for (const { id, ...rest } of 字形.references) {
      const 引用字形 = this.字形表.get(id);
      if (!引用字形) {
        throw new Error(`字形 ${id} 不存在于字形查找表中`);
      }
      const 已解析 = this.解引用字形(引用字形, 最大深度 - 1);
      已解引用.push({
        ...rest,
        glyph: 已解析,
      });
    }
    const { references: _, ...base } = 字形;
    return {
      ...base,
      references: 已解引用,
    };
  }

  /**
   * 在已解引用的字形树上进行模式匹配。
   * 返回 true 表示匹配成功，同时将变量绑定写入映射。
   */
  private 匹配模式(字形: 字形树数据, 模式: 模式, 映射: 模式变量映射): boolean {
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
    if (字形.type !== "compound") return false;
    const { operator, references } = 模式;
    // 匹配结构描述字符
    if (typeof operator === "string") {
      if (字形.operator !== operator) return false;
    } else {
      // OperatorVariable
      const { variable, opearator_set } = operator;
      if (opearator_set && !opearator_set.includes(字形.operator)) return false;
      const bound = 映射.operator映射.get(variable);
      if (bound !== undefined) return bound !== 字形.operator;
      映射.operator映射.set(variable, 字形.operator);
    }
    // 匹配子节点
    if (references.length !== 字形.references.length) return false;
    for (let i = 0; i < references.length; i++) {
      const 子字形 = 字形.references[i]!.glyph;
      if (!this.匹配模式(子字形, references[i]!, 映射)) return false;
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
    字形查找表: Map<number, 字形树数据>,
    取新ID: () => number,
  ): 字形树数据 | null {
    // ID：直接查表返回
    if (typeof 模式 === "number") {
      return 字形查找表.get(模式) ?? null;
    }
    // IDVariable：根据变量绑定查找对应的字形
    if (!("references" in 模式)) {
      const glyphId = 映射.id映射.get(模式.variable);
      if (glyphId === undefined) return null;
      return 字形查找表.get(glyphId) ?? null;
    }
    // 复合模式：递归合成新的复合体树数据
    const { operator, references } = 模式;
    // 解析结构描述字符
    let 已解析Operator: 结构描述字符;
    if (typeof operator === "string") {
      已解析Operator = operator;
    } else {
      const op = 映射.operator映射.get(operator.variable);
      if (!op) return null;
      已解析Operator = op;
    }
    // 递归合成子节点
    const 子引用: 解引用数据[] = [];
    for (const 子模式 of references) {
      const 子字形 = this.合成字形(子模式, 映射, 字形查找表, 取新ID);
      if (!子字形) return null;
      子引用.push({ glyph: 子字形 });
    }
    return {
      type: "compound",
      id: 取新ID(),
      operator: 已解析Operator,
      references: 子引用,
    };
  }

  /**
   * 确定每个字符的最终字形列表。
   *
   * 流程：
   * 1. 解引用字形查找表中的所有字形
   * 2. 针对每个字符，依次应用拼写运算，匹配 from 模式并执行增删改
   * 3. 将变更累积到字形自定义（补丁）中
   * 4. 返回新的字形查找表和字符查找表
   *
   * 新合成的字形使用占位符 ID。
   */
  确定(
    字形自定义: 字形自定义,
    拼写运算列表: 字形拼写运算[],
    字形来源列表: string[],
  ) {
    // 1. 解引用所有字形
    const 字形查找表 = new Map<number, 字形树数据>();
    for (const [id, 字形] of this.字形表) {
      字形查找表.set(id, this.解引用字形(字形));
    }

    // 2. 复制字符查找表（深拷贝 glyphs 数组以便修改）
    const 字符查找表 = new Map<字符, 字形历史记录>();
    for (const 字符数据 of this.字符表.values()) {
      const glyphs: 字形单一来源数据[] = [];
      for (const 来源数据 of 字符数据.glyphs) {
        for (const source of 来源数据.sources) {
          glyphs.push({ id: 来源数据.id, source });
        }
      }
      字符查找表.set(字符数据.character, {
        original: glyphs,
        steps: [],
        final: [],
        filtered: [],
      });
    }

    // 3. 新字形 ID 分配器
    let 新ID计数器 = 30 * 2 ** 15;
    const 取新ID = () => 新ID计数器++;

    // 4. 对每个字符应用拼写运算
    for (const 字形列表历史 of 字符查找表.values()) {
      let glyphs = 字形列表历史.original!;
      for (const [index, 运算] of 拼写运算列表.entries()) {
        const nextGlyphs: 字形单一来源数据[] = [];
        for (const 来源数据 of glyphs) {
          const 字形 = 字形查找表.get(来源数据.id);
          if (!字形) continue;
          const 变量映射: 模式变量映射 = {
            id映射: new Map(),
            operator映射: new Map(),
          };

          if (this.匹配模式(字形, 运算.from, 变量映射)) {
            switch (运算.type) {
              case "erase": {
                break;
              }
              case "xform": {
                const 新字形 = this.合成字形(
                  运算.to,
                  变量映射,
                  字形查找表,
                  取新ID,
                );
                if (!新字形) break;
                字形查找表.set(新字形.id, 新字形);
                nextGlyphs.push({
                  id: 新字形.id,
                  source: 来源数据.source,
                });
                break;
              }
              case "derive": {
                const 新字形 = this.合成字形(
                  运算.to,
                  变量映射,
                  字形查找表,
                  取新ID,
                );
                if (!新字形) break;
                字形查找表.set(新字形.id, 新字形);
                nextGlyphs.push({
                  id: 新字形.id,
                  source: 来源数据.source,
                });
                break;
              }
            }
          }
        }
        字形列表历史.steps[index] = nextGlyphs;
        glyphs = nextGlyphs;
      }
      const finalIndex = 拼写运算列表.length - 1;
      字形列表历史.final = [...字形列表历史.steps[finalIndex]!];
    }

    // 5. 对每个字符应用字形自定义补丁
    for (const [字符串, 补丁列表] of Object.entries(字形自定义)) {
      const 字符数据 = this.校验(字符串);
      if (!字符数据) continue;
      const 字形列表历史 = 字符查找表.get(字符数据.character)!;
      const 单一补丁列表: 字符数据单一补丁[] = [];
      for (const 补丁 of 补丁列表) {
        const { sources, ...rest } = 补丁;
        for (const source of 补丁.sources) {
          单一补丁列表.push({ ...rest, source });
        }
      }
      for (const 补丁 of 单一补丁列表) {
        switch (补丁.type) {
          case "delete": {
            字形列表历史.final = 字形列表历史.final.filter(
              (来源数据) => 来源数据.source !== 补丁.source,
            );
            break;
          }
          case "update": {
            const 字形 = 字形查找表.get(补丁.id);
            if (!字形) continue;
            字形列表历史.final = 字形列表历史.final.map((来源数据) =>
              来源数据.source === 补丁.source
                ? { id: 补丁.id, source: 来源数据.source }
                : 来源数据,
            );
            break;
          }
          case "insert": {
            const 字形 = 字形查找表.get(补丁.id);
            if (!字形) continue;
            字形列表历史.final.push({ id: 补丁.id, source: 补丁.source });
            break;
          }
        }
      }
    }

    // 6. 最后根据字形来源列表过滤每个字符的字形来源
    for (const 字形列表历史 of 字符查找表.values()) {
      字形列表历史.filtered = 字形列表历史.final.filter((来源数据) =>
        字形来源列表.includes(来源数据.source),
      );
    }

    return new 字库(字符查找表, 字形查找表);
  }

  校验自定义映射(自定义元素集合: Record<string, 自定义分析>) {
    const 自定义分析映射: 自定义分析映射 = new Map();
    const 自定义元素映射 = new Map<string, 自定义元素[]>();
    for (const [类别, 映射] of Object.entries(自定义元素集合)) {
      const 元素名称映射 = new Map<string, 自定义元素>();
      for (const [汉字, 元素名称列表] of Object.entries(映射)) {
        const 字符实例 = this.校验(汉字);
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
        const 字符实例 = this.校验(字符)?.character;
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
        const 汉字数据 = this.查询(汉字);
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
        const 汉字数据 = this.查询(汉字);
        if (!汉字数据) continue;
        字符集合.add(汉字);
      }
    }
    return 字符集合;
  }
}

export { 原始字库 };
