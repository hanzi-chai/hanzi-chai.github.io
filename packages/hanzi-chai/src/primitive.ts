import { 图形盒子 } from "./affine.js";
import type { 字形自定义 } from "./config.js";
import type {
  原始字库数据,
  原始汉字数据,
  基本部件数据,
  字形数据,
  汉字数据,
  矢量图形数据,
  约化字形数据,
} from "./data.js";
import { 字库 } from "./repertoire.js";
import { 是汉字或兼容汉字, 是用户私用区 } from "./unicode.js";
import {
  default_err,
  ok,
  type Result,
  是部件或全等,
  模拟基本部件,
  码,
  获取地区标签列表,
} from "./utils.js";

class 原始字库 {
  constructor(private 字库: 原始字库数据) {}

  _get(): 原始字库数据 {
    return this.字库;
  }

  查询(汉字: string): 原始汉字数据 | undefined {
    return this.字库[汉字];
  }

  /**
   * 将原始字符集转换为字符集
   * 主要的工作是对每个字符，在数据库中的多个字形中选取一个
   *
   * @param 自定义字形 - 自定义字形
   * @param 自定义字音 - 自定义读音
   * @param 标签列表 - 用户选择的标签
   *
   * 基本逻辑为，对于每个字符，
   * - 如果用户指定了字形，则使用用户指定的字形
   * - 如果用户指定的某个标签匹配上了这个字符的某个字形，则使用这个字形
   * - 如果都没有，就使用默认字形
   */
  确定(自定义字形: 字形自定义 = {}): Result<字库, Error> {
    const 确定字库 = new 字库();
    const 字形缓存: Map<string, 矢量图形数据> = new Map();
    for (const [汉字名, 汉字] of Object.entries(this.字库)) {
      const { ambiguous: _, glyphs, ...rest } = 汉字;
      const 字形列表: 字形数据[] = [];
      const 自定义字形或字形列表 = 自定义字形[汉字名];
      if (自定义字形或字形列表 !== undefined) {
        字形列表.push(...自定义字形或字形列表);
      }
      if (是汉字或兼容汉字(汉字名)) {
        // 如果在自定义字形中有一个是没有任何地区标签的，那么视为其具有所有地区标签，不再考虑其他字形
        if (!字形列表.some((x) => 获取地区标签列表(x).length === 0)) {
          // 对于汉字，按照地区标签来选择
          const 已有地区标签集合 = new Set(字形列表.flatMap(获取地区标签列表));
          for (const glyph of glyphs) {
            const 剩余地区标签列表 = 获取地区标签列表(glyph).filter(
              (x) => !已有地区标签集合.has(x),
            );
            if (剩余地区标签列表.length === 0) continue;
            字形列表.push({ ...glyph, tags: 剩余地区标签列表 });
            剩余地区标签列表.map((x) => 已有地区标签集合.add(x));
          }
        }
      } else if (是用户私用区(汉字名)) {
        字形列表.push(...glyphs);
      } else {
        if (字形列表.length === 0 && glyphs.length > 0) {
          字形列表.push(glyphs[0]!);
        }
      }
      const 渲染后字形列表: 约化字形数据[] = [];
      for (const glyph of 字形列表) {
        const 渲染后字形 = this.递归渲染原始字形(glyph, 字形缓存, [汉字名]);
        if (!渲染后字形.ok) return 渲染后字形;
        渲染后字形列表.push(渲染后字形.value);
      }
      if (渲染后字形列表.length === 0) {
        渲染后字形列表.push(模拟基本部件());
      }
      const 确定汉字: 汉字数据 = {
        ...rest,
        glyphs: 渲染后字形列表,
      };
      确定字库.添加(汉字名, 确定汉字);
    }
    return ok(确定字库);
  }

  获取源部件(
    字符: string,
    字形缓存: Map<string, 矢量图形数据> = new Map(),
    栈: string[] = [],
  ): Result<基本部件数据, Error> {
    const 源字 = this.字库[字符];
    const 字符信息 = `${字符} (U+${码(字符)} )`;
    const 栈信息 = 栈.map((x) => `${x} (U+${码(x)})`).join(" -> ");
    if (源字 === undefined)
      return default_err(`源部件 ${字符信息} 不存在，当前栈：${栈信息}`);
    const 源字形 = 源字.glyphs.find(是部件或全等);
    if (源字形 === undefined)
      return default_err(
        `源部件 ${字符信息} 没有部件或全等，当前栈：${栈信息}`,
      );
    const 渲染后源字形 = this.递归渲染原始字形(源字形, 字形缓存, [...栈, 字符]);
    if (!渲染后源字形.ok) return 渲染后源字形;
    const value = 渲染后源字形.value;
    if (value.type !== "basic_component")
      return default_err(`源部件 ${字符信息} 不是基本部件，当前栈：${栈信息}`);
    return ok(value);
  }

  /**
   * 递归渲染一个部件（基本部件或者衍生部件）
   * 如果是基本部件就直接返回，如果是衍生部件则先渲染源字的图形，然后解引用得到这个部件的图形
   *
   * @param component - 部件
   * @param repertoire - 原始字符集
   * @param 字形缓存 - 部件缓存
   *
   * @returns 部件的 SVG 图形
   */
  递归渲染原始字形(
    字形: 字形数据,
    字形缓存: Map<string, 矢量图形数据> = new Map(),
    栈: string[] = [],
  ): Result<约化字形数据, Error> {
    if (栈.length > 100) {
      return default_err(`递归渲染字形时递归深度过大：${栈.join(" -> ")}`);
    }
    const tags = 字形.tags;
    if (字形.type === "derived_component") {
      const 渲染后源字形 = this.获取源部件(字形.source, 字形缓存, 栈);
      if (!渲染后源字形.ok) return 渲染后源字形;
      const strokes: 矢量图形数据 = [];
      字形.strokes.forEach((x) => {
        if (x.feature === "reference") {
          const 源笔画 = 渲染后源字形.value.strokes[x.index];
          if (源笔画 === undefined) return; // 允许指标越界
          strokes.push(源笔画);
        } else {
          strokes.push(x);
        }
      });
      return ok({ type: "basic_component", tags, strokes });
    } else if (字形.type === "spliced_component") {
      const 部分列表: 图形盒子[] = [];
      for (const 部分 of 字形.operandList) {
        const 渲染后源字形 = this.获取源部件(部分, 字形缓存, 栈);
        if (!渲染后源字形.ok) return 渲染后源字形;
        部分列表.push(图形盒子.从笔画列表构建(渲染后源字形.value.strokes));
      }
      const 作为复合体 = { ...字形, type: "compound" as const };
      const 笔画列表 = 图形盒子.仿射合并(作为复合体, 部分列表).获取笔画列表();
      return ok({ type: "basic_component", tags, strokes: 笔画列表 });
    } else if (字形.type === "identity") {
      const 源字 = this.字库[字形.source];
      if (源字?.glyphs?.[0] === undefined)
        return default_err(
          `源部件 ${字形.source} 不存在，当前栈：${栈.join(" -> ")}`,
        );
      return this.递归渲染原始字形(源字.glyphs[0]!, 字形缓存, [
        ...栈,
        字形.source,
      ]);
    } else {
      return ok(字形);
    }
  }
}

export { 原始字库 };
