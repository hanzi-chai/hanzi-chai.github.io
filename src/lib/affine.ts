import { add } from "./mathjs";
import type {
  Compound,
  Draw,
  Operator,
  Point,
  SVGGlyph,
  SVGGlyphWithBox,
  SVGStroke,
} from "./data";
import { cloneDeep } from "lodash-es";
import type { BoundingBox } from "./bezier";

class Affine {
  private xscale: number;
  private yscale: number;
  private translate: Point;

  public constructor(
    xscale: number,
    yscale: number,
    translate: Point = [0, 0],
  ) {
    this.xscale = xscale;
    this.yscale = yscale;
    this.translate = translate;
  }

  public transformDraw(draw: Draw): Draw {
    const next: Draw = cloneDeep(draw);
    switch (next.command) {
      case "h":
        next.parameterList[0] *= this.xscale;
        break;
      case "v":
        next.parameterList[0] *= this.yscale;
        break;
      case "c":
      case "z":
        for (const index of [0, 2, 4] as const) {
          next.parameterList[index] *= this.xscale;
          next.parameterList[index + 1]! *= this.yscale;
        }
        break;
    }
    return next;
  }

  public transformSVGStroke(stroke: SVGStroke): SVGStroke {
    const [x, y] = stroke.start;
    const start = add(
      [x * this.xscale, y * this.yscale] as Point,
      this.translate,
    );
    const next = {
      ...stroke,
      start,
      curveList: stroke.curveList.map((c) => this.transformDraw(c)),
    };
    return next;
  }

  public transformSVGGlyph(glyph: SVGGlyph): SVGGlyph {
    return glyph.map((x) => this.transformSVGStroke(x));
  }
}

const id = new Affine(1, 1);
const left = new Affine(0.5, 1);
const right = new Affine(0.5, 1, [50, 0]);
const top = new Affine(1, 0.5);
const bottom = new Affine(1, 0.5, [0, 50]);
const leftThird = new Affine(0.33, 1);
const centerThird = new Affine(0.33, 1, [33, 0]);
const rightThird = new Affine(0.33, 1, [66, 0]);
const topThird = new Affine(1, 0.33);
const middleThird = new Affine(1, 0.33, [0, 33]);
const bottomThird = new Affine(1, 0.33, [0, 66]);

const affineMap: Record<Operator, Affine[]> = {
  "⿰": [left, right],
  "⿱": [top, bottom],
  "⿲": [leftThird, centerThird, rightThird],
  "⿳": [topThird, middleThird, bottomThird],
  "⿴": [id, new Affine(0.5, 0.5, [25, 25])],
  "⿵": [id, new Affine(0.5, 0.5, [25, 40])],
  "⿶": [id, new Affine(0.5, 0.5, [25, 10])],
  "⿷": [id, new Affine(0.5, 0.5, [40, 25])],
  "⿸": [id, new Affine(0.5, 0.5, [40, 40])],
  "⿹": [id, new Affine(0.5, 0.5, [10, 40])],
  "⿺": [id, new Affine(0.5, 0.5, [40, 10])],
  "⿻": [id, id],
  "⿾": [id],
  "⿿": [id],
};

/**
 * 给定复合体数据和各部分渲染后的 SVG 图形，返回合并后的 SVG 图形
 * @param compound - 复合体数据
 * @param glyphList - 各部分渲染后的 SVG 图形
 * @returns 合并后的 SVG 图形
 */
export function affineMerge(compound: Compound, glyphList: SVGGlyphWithBox[]) {
  const { operator, order, parameters } = compound;
  const transformedGlyphs: SVGGlyph[] = [];
  const boundingBox: BoundingBox = { x: [0, 100], y: [0, 100] };
  if (["⿰", "⿲", "⿱", "⿳"].includes(operator)) {
    // 上下、上中下、左右、左中右，直接拼接
    let mainAxisOffset = 0;
    const isLR = ["⿰", "⿲"].includes(operator);
    for (const [index, { strokes, box }] of glyphList.entries()) {
      const mainAxisLength = isLR ? box.x[1] - box.x[0] : box.y[1] - box.y[0];
      if (index === 0) {
        transformedGlyphs.push(structuredClone(strokes));
        boundingBox.x = structuredClone(box.x);
        boundingBox.y = structuredClone(box.y);
        mainAxisOffset = isLR ? box.x[1] : box.y[1];
        continue;
      }
      let gap = 20;
      if (index === 1 && parameters?.gap2 !== undefined) {
        gap = parameters.gap2;
      } else if (index === 2 && parameters?.gap3 !== undefined) {
        gap = parameters.gap3;
      }
      mainAxisOffset += gap;
      const increase = gap + mainAxisLength;
      let affine: Affine;
      if (isLR) {
        affine = new Affine(1, 1, [mainAxisOffset - box.x[0], 0]);
        boundingBox.x[1] += increase;
        boundingBox.y[0] = Math.min(boundingBox.y[0], box.y[0]);
        boundingBox.y[1] = Math.max(boundingBox.y[1], box.y[1]);
      } else {
        affine = new Affine(1, 1, [0, mainAxisOffset - box.y[0]]);
        boundingBox.y[1] += increase;
        boundingBox.x[0] = Math.min(boundingBox.x[0], box.x[0]);
        boundingBox.x[1] = Math.max(boundingBox.x[1], box.x[1]);
      }
      transformedGlyphs.push(affine.transformSVGGlyph(strokes));
      mainAxisOffset += mainAxisLength;
    }
  } else {
    // 包围或结构，暂时还没有优化拼接的算法，用原来的仿射变换算法
    for (const [index, affine] of affineMap[operator].entries()) {
      const transformed = affine.transformSVGGlyph(glyphList[index]?.strokes);
      transformedGlyphs.push(transformed);
    }
  }
  const result: SVGGlyph = [];
  if (order === undefined) {
    result.push(...transformedGlyphs.flat());
  } else {
    for (const { index, strokes } of order) {
      const glyph = transformedGlyphs[index];
      if (glyph === undefined) continue;
      if (strokes === 0) {
        result.push(...glyph);
      } else {
        result.push(...glyph.slice(0, strokes));
        transformedGlyphs[index] = glyph.slice(strokes);
      }
    }
  }
  const merged: SVGGlyphWithBox = {
    strokes: result,
    box: boundingBox,
  };
  return merged;
}
