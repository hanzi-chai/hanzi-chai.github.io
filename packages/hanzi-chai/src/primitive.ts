import type {
  Compound,
  Character,
  PrimitiveRepertoire,
  SVGGlyph,
  Glyph,
  BasicComponent,
} from "./data.js";
import { getDummyBasicComponent, 是部件或全等 } from "./utils.js";
import {
  getGlyphBoundingBox,
  type SVGGlyphWithBox,
  仿射合并,
} from "./affine.js";
import type { CustomGlyph, CustomReadings } from "./config.js";
import 字库 from "./repertoire.js";

class 原始字库 {
  constructor(private readonly 字库: PrimitiveRepertoire) {}

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
    自定义字形: CustomGlyph = {},
    自定义字音: CustomReadings = {},
    标签列表: string[] = [],
  ) {
    const 确定字库 = new 字库();
    const 字形缓存: Map<string, SVGGlyph> = new Map();
    for (const [汉字名, 汉字] of Object.entries(this.字库)) {
      const { ambiguous: _, glyphs, readings, ...rest } = 汉字;
      let 选定字形 = glyphs[0];
      for (const 标签 of 标签列表) {
        const 含标签字形 = glyphs.find((x) => (x.tags ?? []).includes(标签));
        if (含标签字形 !== undefined) {
          选定字形 = 含标签字形;
          break;
        }
      }
      const 原始字形 =
        自定义字形[汉字名] ?? 选定字形 ?? getDummyBasicComponent();
      const 字形 = this.递归渲染原始字形(原始字形, 字形缓存);
      if (字形 instanceof Error) throw 字形;
      const 最终读音 = 自定义字音[汉字名] ?? readings;
      const 确定汉字: Character = {
        ...rest,
        glyph: 字形,
        readings: 最终读音,
      };
      确定字库.add(汉字名, 确定汉字);
    }
    return 确定字库;
  }

  获取源部件(name: string, 字形缓存: Map<string, SVGGlyph>, 深度: number) {
    const 源字 = this.字库[name];
    if (源字 === undefined) return;
    const 源字形 = 源字.glyphs.find(是部件或全等);
    if (源字形 === undefined) return;
    const 渲染后源字形 = this.递归渲染原始字形(源字形, 字形缓存, 深度 + 1);
    if (渲染后源字形 instanceof Error || 渲染后源字形.type === "compound")
      return;
    return 渲染后源字形;
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
   * @throws Error 无法渲染
   */
  递归渲染原始字形(
    字形: Glyph,
    字形缓存: Map<string, SVGGlyph> = new Map(),
    深度 = 0,
  ): BasicComponent | Compound | Error {
    if (深度 > 100) {
      console.error("Recursion depth exceeded", 字形);
      return new Error();
    }
    const tags = 字形.tags;
    if (字形.type === "derived_component") {
      const 渲染后源字形 = this.获取源部件(字形.source, 字形缓存, 深度);
      if (渲染后源字形 === undefined) return new Error();
      const strokes: SVGGlyph = [];
      字形.strokes.forEach((x) => {
        if (x.feature === "reference") {
          const 源笔画 = 渲染后源字形.strokes[x.index];
          if (源笔画 === undefined) return; // 允许指标越界
          strokes.push(源笔画);
        } else {
          strokes.push(x);
        }
      });
      return { type: "basic_component", tags, strokes };
    } else if (字形.type === "spliced_component") {
      const 部分列表: SVGGlyphWithBox[] = [];
      for (const 部分 of 字形.operandList) {
        const 渲染后源字形 = this.获取源部件(部分, 字形缓存, 深度);
        if (渲染后源字形 === undefined) return new Error();
        const box = getGlyphBoundingBox(渲染后源字形.strokes);
        部分列表.push({ strokes: 渲染后源字形.strokes, box });
      }
      const 作为复合体 = { ...字形, type: "compound" as const };
      const { strokes } = 仿射合并(作为复合体, 部分列表);
      return { type: "basic_component", tags, strokes };
    } else if (字形.type === "identity") {
      const 渲染后源字形 = this.获取源部件(字形.source, 字形缓存, 深度);
      if (渲染后源字形 === undefined) return new Error();
      return 渲染后源字形;
    } else {
      return 字形;
    }
  }
}

export default 原始字库;
