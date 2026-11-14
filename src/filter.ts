import { 复合体 } from "./compound.js";
import type { 字符数据, 结构描述字符 } from "./data.js";
import { 解析字形ID } from "./glyph-id.js";
import type { 字库, 字形 } from "./repertoire.js";
import type { 字符 } from "./unicode.js";

export class 字符字形过滤器 {
  private sequenceRegex: RegExp | undefined;
  constructor(private 过滤条件: 过滤器参数) {
    if (过滤条件.sequence) {
      try {
        this.sequenceRegex = new RegExp(过滤条件.sequence, "u");
      } catch {}
    }
  }

  过滤字符(字符: 字符, 字符数据: 字符数据, 字库: 字库) {
    let result = true;
    const { name, id, source } = this.过滤条件;
    if (id) {
      const hex_str = 字符.toNumber().toString(16);
      const dec_str = 字符.toNumber().toString(10);
      result &&= id.toLowerCase() === hex_str || id === dec_str;
    }
    if (name) {
      result &&= 字符.获取名称().includes(name);
    }
    if (source)
      result &&= 字符数据.glyphs.some((glyph) =>
        glyph.sources.includes(source),
      );
    const 字形列表 = 字库.查询字符的字形(字符) ?? [];
    result &&= 字形列表.some((glyph) => {
      let subResult = true;
      if (this.sequenceRegex !== undefined) {
        subResult &&= this.sequenceRegex!.test(glyph.标准笔顺);
      }
      if (this.过滤条件.operator) {
        subResult &&=
          glyph instanceof 复合体 &&
          glyph.结构描述字符 === this.过滤条件.operator;
      }
      if (this.过滤条件.part) {
        subResult &&=
          glyph instanceof 复合体 &&
          glyph.部分列表.some((p) => p.id === 解析字形ID(this.过滤条件.part!));
      }
      return subResult;
    });
    return result;
  }

  过滤字形(glyph: 字形, 字库: 字库) {
    const { id, name, operator, part } = this.过滤条件;
    let result = true;
    if (id) {
      result &&= 解析字形ID(id) === glyph.id;
    }
    if (name) {
      const 别名匹配 = (glyph.name ?? "").includes(name);
      let 字符匹配 = false;
      const 字符 = 字库.校验字符(name)?.character;
      if (字符) {
        const 字形列表 = 字库.查询字符的字形(字符) ?? [];
        字符匹配 = 字形列表.some((g) => g.id === glyph.id);
      }
      result &&= 别名匹配 || 字符匹配;
    }
    if (this.sequenceRegex !== undefined) {
      result &&= this.sequenceRegex!.test(glyph.标准笔顺);
    }
    if (operator) {
      result &&= glyph instanceof 复合体 && glyph.结构描述字符 === operator;
    }
    if (part) {
      result &&=
        glyph instanceof 复合体 &&
        glyph.部分列表.some((p) => p.id === 解析字形ID(part));
    }
    return result;
  }
}

export interface 过滤器参数 {
  id?: string;
  name?: string;
  sequence?: string;
  source?: string;
  part?: string;
  operator?: 结构描述字符;
}
