import { add } from "mathjs";
import type {
  Compound,
  Draw,
  Operator,
  Point,
  SVGGlyph,
  SVGStroke,
} from "./data";
import { cloneDeep } from "lodash-es";

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
          next.parameterList[index + 1] *= this.yscale;
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
};

/**
 * 给定复合体数据和各部分渲染后的 SVG 图形，返回合并后的 SVG 图形
 * @param compound - 复合体数据
 * @param glyphList - 各部分渲染后的 SVG 图形
 * @returns 合并后的 SVG 图形
 */
export function affineMerge(compound: Compound, glyphList: SVGGlyph[]) {
  const { operator, order } = compound;
  const transformedGlyphs: SVGGlyph[] = [];
  for (const [index, affine] of affineMap[operator].entries()) {
    const transformed = affine.transformSVGGlyph(glyphList[index]!);
    transformedGlyphs.push(transformed);
  }
  if (order === undefined) return transformedGlyphs.flat();
  const result: SVGGlyph = [];
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
  return result;
}
