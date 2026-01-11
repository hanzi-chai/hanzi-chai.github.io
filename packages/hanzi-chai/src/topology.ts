import { 创建曲线, type 区间, type 曲线, type 曲线关系 } from "./bezier.js";
import { Feature } from "./classifier.js";
import type { SVGStroke } from "./data.js";

type 笔画关系 = 曲线关系[];

/**
 * 渲染后的笔画
 * 这个类型和 SVGStroke 的区别是，这个类型包含了一系列 Bezier 曲线，而 SVGStroke 包含了一系列 SVG 命令
 * Bezier 曲线里每一段的起点和终点都是显式写出的，所以比较适合于计算
 */
class 笔画图形 {
  feature: Feature;
  curveList: 曲线[];

  constructor({ feature, start, curveList }: SVGStroke) {
    this.feature = feature;
    this.curveList = [];
    let previousPosition = start;
    for (const draw of curveList) {
      const curve = 创建曲线(previousPosition, draw);
      previousPosition = curve.evaluate(1);
      this.curveList.push(curve);
    }
  }

  isBoundedBy(xrange: 区间, yrange: 区间): boolean {
    return this.curveList.every((x) => x.isBoundedBy(xrange, yrange));
  }

  relation(stroke2: 笔画图形): 笔画关系 {
    const strokeRelation: 笔画关系 = [];
    for (const curve1 of this.curveList) {
      for (const curve2 of stroke2.curveList) {
        strokeRelation.push(curve1.relation(curve2));
      }
    }
    return strokeRelation;
  }
}

class 拓扑 {
  matrix: 笔画关系[][];
  orientedPairs: [number, number][];

  constructor(renderedGlyph: 笔画图形[]) {
    this.matrix = [];
    this.orientedPairs = [];
    for (const [index1, stroke1] of renderedGlyph.entries()) {
      const row: 笔画关系[] = [];
      for (const [index2, stroke2] of renderedGlyph.entries()) {
        if (index1 === index2) row.push([]);
        else row.push(stroke1.relation(stroke2));
      }
      this.matrix.push(row);
    }
    for (const [index1] of renderedGlyph.entries()) {
      for (const [index2] of renderedGlyph.entries()) {
        if (index2 >= index1) break;
        const relations = this.matrix[index1]![index2]!;
        if (relations.some((v) => v.type === "交" || v.type === "连")) continue;
        const parallelIndex = relations.findIndex(
          (v) => v.type === "平行" && v.mainAxis === 0,
        );
        if (parallelIndex !== -1) {
          this.orientedPairs.push([index1, index2]);
        }
      }
    }
  }
}

export { 笔画图形, 拓扑, type 笔画关系 };
