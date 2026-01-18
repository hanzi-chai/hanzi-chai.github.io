import { add } from "./math.js";
import type {
  Compound,
  Draw,
  Operator,
  Point,
  SVGGlyph,
  SVGStroke,
} from "./data.js";
import { cloneDeep } from "lodash-es";
import { 区间 } from "./bezier.js";

class 仿射变换 {
  static id = new 仿射变换(1, 1);
  static left = new 仿射变换(0.5, 1);
  static right = new 仿射变换(0.5, 1, [50, 0]);
  static top = new 仿射变换(1, 0.5);
  static bottom = new 仿射变换(1, 0.5, [0, 50]);
  static leftThird = new 仿射变换(0.33, 1);
  static centerThird = new 仿射变换(0.33, 1, [33, 0]);
  static rightThird = new 仿射变换(0.33, 1, [66, 0]);
  static topThird = new 仿射变换(1, 0.33);
  static middleThird = new 仿射变换(1, 0.33, [0, 33]);
  static bottomThird = new 仿射变换(1, 0.33, [0, 66]);
  static 查找表: Record<Operator, 仿射变换[]> = {
    "⿰": [仿射变换.left, 仿射变换.right],
    "⿱": [仿射变换.top, 仿射变换.bottom],
    "⿲": [仿射变换.leftThird, 仿射变换.centerThird, 仿射变换.rightThird],
    "⿳": [仿射变换.topThird, 仿射变换.middleThird, 仿射变换.bottomThird],
    "⿴": [仿射变换.id, new 仿射变换(0.5, 0.5, [25, 25])],
    "⿵": [仿射变换.id, new 仿射变换(0.5, 0.5, [25, 40])],
    "⿶": [仿射变换.id, new 仿射变换(0.5, 0.5, [25, 10])],
    "⿷": [仿射变换.id, new 仿射变换(0.5, 0.5, [40, 25])],
    "⿸": [仿射变换.id, new 仿射变换(0.5, 0.5, [40, 40])],
    "⿹": [仿射变换.id, new 仿射变换(0.5, 0.5, [10, 40])],
    "⿺": [仿射变换.id, new 仿射变换(0.5, 0.5, [40, 10])],
    "⿼": [仿射变换.id, new 仿射变换(0.5, 0.5, [10, 25])],
    "⿽": [仿射变换.id, new 仿射变换(0.5, 0.5, [10, 10])],
    "⿻": [仿射变换.id, 仿射变换.id],
    "⿾": [仿射变换.id],
    "⿿": [仿射变换.id],
  };

  public constructor(
    private 横向缩放: number,
    private 纵向缩放: number,
    private 平移: Point = [0, 0],
  ) {}

  public 变换线段(动作: Draw): Draw {
    const 新动作: Draw = cloneDeep(动作);
    switch (新动作.command) {
      case "h":
        新动作.parameterList[0] *= this.横向缩放;
        break;
      case "v":
        新动作.parameterList[0] *= this.纵向缩放;
        break;
      case "c":
      case "z":
        for (const index of [0, 2, 4] as const) {
          新动作.parameterList[index] *= this.横向缩放;
          新动作.parameterList[index + 1]! *= this.纵向缩放;
        }
        break;
    }
    return 新动作;
  }

  public 变换笔画(笔画: SVGStroke): SVGStroke {
    const [x, y] = 笔画.start;
    const start = add(
      [x * this.横向缩放, y * this.纵向缩放] as Point,
      this.平移,
    );
    const 新笔画 = {
      ...笔画,
      start,
      curveList: 笔画.curveList.map((c) => this.变换线段(c)),
    };
    return 新笔画;
  }

  public 变换笔画列表(glyph: SVGGlyph): SVGGlyph {
    return glyph.map((x) => this.变换笔画(x));
  }
}

class 图形盒子 {
  constructor(
    private 笔画列表: SVGStroke[],
    private 横向区间: 区间,
    private 纵向区间: 区间,
  ) {}

  static 从笔画列表构建(笔画列表: SVGStroke[]) {
    let [xmin, ymin, xmax, ymax] = [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ];
    for (const { start, curveList } of 笔画列表) {
      let [x, y] = start;
      xmin = Math.min(xmin, x);
      ymin = Math.min(ymin, y);
      xmax = Math.max(xmax, x);
      ymax = Math.max(ymax, y);
      for (const { command, parameterList } of curveList) {
        switch (command) {
          case "h":
            x += parameterList[0];
            break;
          case "v":
            y += parameterList[0];
            break;
          case "a":
            xmin = Math.min(xmin, x - parameterList[0]);
            xmax = Math.max(xmax, x + parameterList[0]);
            ymax = Math.max(ymax, y + 2 * parameterList[0]);
            break;
          default: {
            const [_x1, _y1, _x2, _y2, x3, y3] = parameterList;
            x += x3;
            y += y3;
            break;
          }
        }
        xmin = Math.min(xmin, x);
        ymin = Math.min(ymin, y);
        xmax = Math.max(xmax, x);
        ymax = Math.max(ymax, y);
      }
    }
    const x = new 区间(xmin, xmax);
    const y = new 区间(ymin, ymax);
    return new 图形盒子(笔画列表, x, y);
  }

  /**
   * 给定复合体数据和各部分渲染后的 SVG 图形，返回合并后的 SVG 图形
   * @param 复合体 - 复合体数据
   * @param 部分列表 - 各部分渲染后的 SVG 图形
   * @returns 合并后的 SVG 图形
   */
  static 仿射合并(复合体: Compound, 部分列表: 图形盒子[]) {
    const { operator, order, parameters } = 复合体;
    const 变换后图形列表: SVGGlyph[] = [];
    let 新横向边界 = new 区间(0, 100);
    let 新纵向边界 = new 区间(0, 100);
    if (["⿰", "⿲", "⿱", "⿳"].includes(operator)) {
      // 上下、上中下、左右、左中右，直接拼接
      let 主轴起点 = 0;
      const 是左右结构 = ["⿰", "⿲"].includes(operator);
      for (const [
        index,
        { 笔画列表, 横向区间, 纵向区间 },
      ] of 部分列表.entries()) {
        const 主轴长度 = 是左右结构 ? 横向区间.长度() : 纵向区间.长度();
        if (index === 0) {
          变换后图形列表.push(structuredClone(笔画列表));
          新横向边界 = structuredClone(横向区间);
          新纵向边界 = structuredClone(纵向区间);
          主轴起点 = 是左右结构 ? 横向区间.interval[1] : 纵向区间.interval[1];
          continue;
        }
        let gap = 20;
        if (index === 1 && parameters?.gap2 !== undefined) {
          gap = parameters.gap2;
        } else if (index === 2 && parameters?.gap3 !== undefined) {
          gap = parameters.gap3;
        }
        主轴起点 += gap;
        const increase = gap + 主轴长度;
        let 变换: 仿射变换;
        if (是左右结构) {
          变换 = new 仿射变换(1, 1, [主轴起点 - 横向区间.interval[0], 0]);
          新横向边界.interval[1] += increase;
          新纵向边界 = 新纵向边界.取并集(纵向区间);
        } else {
          变换 = new 仿射变换(1, 1, [0, 主轴起点 - 纵向区间.interval[0]]);
          新纵向边界.interval[1] += increase;
          新横向边界 = 新横向边界.取并集(横向区间);
        }
        变换后图形列表.push(变换.变换笔画列表(笔画列表));
        主轴起点 += 主轴长度;
      }
    } else {
      // 包围或结构，暂时还没有优化拼接的算法，用原来的仿射变换算法
      for (const [index, 变换] of 仿射变换.查找表[operator].entries()) {
        const 变换后图形 = 变换.变换笔画列表(部分列表[index]!.笔画列表);
        变换后图形列表.push(变换后图形);
      }
    }
    const 合并图形: SVGGlyph = [];
    if (order === undefined) {
      合并图形.push(...变换后图形列表.flat());
    } else {
      for (const { index, strokes } of order) {
        const glyph = 变换后图形列表[index];
        if (glyph === undefined) continue;
        if (strokes === 0) {
          合并图形.push(...glyph);
        } else {
          合并图形.push(...glyph.slice(0, strokes));
          变换后图形列表[index] = glyph.slice(strokes);
        }
      }
    }
    return new 图形盒子(合并图形, 新横向边界, 新纵向边界);
  }
}

export { 图形盒子 };
