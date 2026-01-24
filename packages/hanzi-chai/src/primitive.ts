import { 图形盒子 } from "./affine.js";
import type { 字形自定义 } from "./config.js";
import type {
  原始字库数据,
  原始汉字数据,
  基本部件数据,
  复合体数据,
  字形数据,
  汉字数据,
  矢量图形数据,
} from "./data.js";
import { 字库 } from "./repertoire.js";
import {
  模拟基本部件,
  是部件或全等,
  type Result,
  default_err,
  ok,
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
  确定(
    自定义字形: 字形自定义 = {},
    标签列表: string[] = [],
  ): Result<字库, Error> {
    const 确定字库 = new 字库();
    const 字形缓存: Map<string, 矢量图形数据> = new Map();
    for (const [汉字名, 汉字] of Object.entries(this.字库)) {
      const { ambiguous: _, glyphs, ...rest } = 汉字;
      let 选定字形 = glyphs[0];
      for (const 标签 of 标签列表) {
        const 含标签字形 = glyphs.find((x) => (x.tags ?? []).includes(标签));
        if (含标签字形 !== undefined) {
          选定字形 = 含标签字形;
          break;
        }
      }
      const 原始字形 = 自定义字形[汉字名] ?? 选定字形 ?? 模拟基本部件();
      const 字形 = this.递归渲染原始字形(原始字形, 字形缓存, [汉字名]);
      if (!字形.ok) return 字形;
      const 确定汉字: 汉字数据 = {
        ...rest,
        glyph: 字形.value,
      };
      确定字库.添加(汉字名, 确定汉字);
    }
    return ok(确定字库);
  }

  获取源部件(
    name: string,
    字形缓存: Map<string, 矢量图形数据> = new Map(),
    栈: string[] = [],
  ): Result<基本部件数据, Error> {
    const 源字 = this.字库[name];
    if (源字 === undefined)
      return default_err(`源部件 ${name} 不存在，当前栈：${栈.join(" -> ")}`);
    const 源字形 = 源字.glyphs.find(是部件或全等);
    if (源字形 === undefined)
      return default_err(
        `源部件 ${name} 没有部件或全等，当前栈：${栈.join(" -> ")}`,
      );
    const 渲染后源字形 = this.递归渲染原始字形(源字形, 字形缓存, [...栈, name]);
    if (!渲染后源字形.ok) return 渲染后源字形;
    const value = 渲染后源字形.value;
    if (value.type !== "basic_component")
      return default_err(
        `源部件 ${name} 不是基本部件，当前栈：${栈.join(" -> ")}`,
      );
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
  ): Result<基本部件数据 | 复合体数据, Error> {
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
