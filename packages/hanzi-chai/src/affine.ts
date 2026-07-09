import { cloneDeep } from "lodash-es";
import { 区间 } from "./bezier.js";
import type {
  向量,
  引用笔画块数据,
  矢量图形数据,
  矢量笔画数据,
  结构描述字符,
  绘制,
} from "./data.js";
import { 加 } from "./math.js";
import type { 复合体树数据 } from "./primitive.js";

class 仿射变换 {
  static id = new 仿射变换(new 区间(0, 100), new 区间(0, 100));
  static left = new 仿射变换(new 区间(0, 50), new 区间(0, 100));
  static right = new 仿射变换(new 区间(50, 100), new 区间(0, 100));
  static top = new 仿射变换(new 区间(0, 100), new 区间(0, 50));
  static bottom = new 仿射变换(new 区间(0, 100), new 区间(50, 100));
  static leftThird = new 仿射变换(new 区间(0, 33), new 区间(0, 100));
  static centerThird = new 仿射变换(new 区间(33, 66), new 区间(0, 100));
  static rightThird = new 仿射变换(new 区间(66, 99), new 区间(0, 100));
  static topThird = new 仿射变换(new 区间(0, 100), new 区间(0, 33));
  static middleThird = new 仿射变换(new 区间(0, 100), new 区间(33, 66));
  static bottomThird = new 仿射变换(new 区间(0, 100), new 区间(66, 99));
  static 查找表: Record<结构描述字符, 仿射变换[]> = {
    "⿰": [仿射变换.left, 仿射变换.right],
    "⿱": [仿射变换.top, 仿射变换.bottom],
    "⿲": [仿射变换.leftThird, 仿射变换.centerThird, 仿射变换.rightThird],
    "⿳": [仿射变换.topThird, 仿射变换.middleThird, 仿射变换.bottomThird],
    "⿴": [仿射变换.id, new 仿射变换(new 区间(25, 75), new 区间(25, 75))],
    "⿵": [仿射变换.id, new 仿射变换(new 区间(25, 75), new 区间(40, 90))],
    "⿶": [仿射变换.id, new 仿射变换(new 区间(25, 75), new 区间(10, 60))],
    "⿷": [仿射变换.id, new 仿射变换(new 区间(40, 90), new 区间(25, 75))],
    "⿸": [仿射变换.id, new 仿射变换(new 区间(40, 90), new 区间(40, 90))],
    "⿹": [仿射变换.id, new 仿射变换(new 区间(10, 60), new 区间(40, 90))],
    "⿺": [仿射变换.id, new 仿射变换(new 区间(40, 90), new 区间(10, 60))],
    "⿼": [仿射变换.id, new 仿射变换(new 区间(10, 60), new 区间(25, 75))],
    "⿽": [仿射变换.id, new 仿射变换(new 区间(10, 60), new 区间(10, 60))],
    "⿻": [仿射变换.id, 仿射变换.id],
    "⿾": [仿射变换.id],
    "⿿": [仿射变换.id],
  };

  private readonly 横向缩放: number;
  private readonly 纵向缩放: number;
  private readonly 平移: 向量;

  static 从边界创建(
    xbegin: number,
    ybegin: number,
    xend: number,
    yend: number,
  ): 仿射变换 {
    return new 仿射变换(new 区间(xbegin, xend), new 区间(ybegin, yend));
  }

  public constructor(x区间: 区间, y区间: 区间) {
    this.横向缩放 = x区间.长度() / 100;
    this.纵向缩放 = y区间.长度() / 100;
    this.平移 = [x区间.起点(), y区间.起点()];
  }

  public 变换线段(动作: 绘制): 绘制 {
    const 新动作: 绘制 = cloneDeep(动作);
    switch (新动作.command) {
      case "h":
        新动作.parameterList[0] = Math.round(
          新动作.parameterList[0] * this.横向缩放,
        );
        break;
      case "v":
        新动作.parameterList[0] = Math.round(
          新动作.parameterList[0] * this.纵向缩放,
        );
        break;
      case "c":
      case "z":
        for (const index of [0, 2, 4] as const) {
          新动作.parameterList[index] = Math.round(
            新动作.parameterList[index] * this.横向缩放,
          );
          新动作.parameterList[index + 1]! = Math.round(
            新动作.parameterList[index + 1]! * this.纵向缩放,
          );
        }
        break;
    }
    return 新动作;
  }

  public 变换笔画(笔画: 矢量笔画数据): 矢量笔画数据 {
    const [x, y] = 笔画.start;
    const start = 加(
      [Math.round(x * this.横向缩放), Math.round(y * this.纵向缩放)] as 向量,
      this.平移,
    );
    const 新笔画 = {
      ...笔画,
      start,
      curveList: 笔画.curveList.map((c) => this.变换线段(c)),
    };
    return 新笔画;
  }

  public 变换笔画列表(glyph: 矢量图形数据): 矢量图形数据 {
    return glyph.map((x) => this.变换笔画(x));
  }
}

class 图形盒子 {
  constructor(
    private 笔画列表: 矢量笔画数据[] = [],
    private 横向区间: 区间 = new 区间(0, 100),
    private 纵向区间: 区间 = new 区间(0, 100),
  ) {}

  获取笔画列表() {
    return this.笔画列表;
  }

  确定笔画粗细和视窗(displayMode: boolean) {
    const strokeWidthPercentage = displayMode ? 0.01 : 0.07;
    const viewBox = `0 0 100 100`;
    const strokeWidth = 100 * strokeWidthPercentage;
    return { strokeWidth, viewBox };
  }

  static 从笔画列表构建(笔画列表: 矢量笔画数据[]) {
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
  static 仿射合并(复合体: 复合体树数据, 部分列表: 图形盒子[]) {
    const { operator, strokes } = 复合体;
    const 变换后图形列表: 矢量图形数据[] = [];
    for (const [index, 变换] of 仿射变换.查找表[operator].entries()) {
      const 变换后图形 = 变换.变换笔画列表(部分列表[index]!.笔画列表);
      变换后图形列表.push(变换后图形);
    }
    const 合并图形 = 合并笔画顺序(变换后图形列表, strokes);
    return new 图形盒子(合并图形, new 区间(0, 100), new 区间(0, 100));
  }
}

/**
 * 按照笔画顺序描述合并多个部分的笔画列表。
 * 当 strokes 为 undefined 或空时，直接拼接所有部分。
 */
export function 合并笔画顺序(
  变换后图形列表: 矢量图形数据[],
  strokes?: 引用笔画块数据[],
): 矢量笔画数据[] {
  if (!strokes || strokes.length === 0) {
    return 变换后图形列表.flat();
  }
  const result: 矢量笔画数据[] = [];
  const remaining = 变换后图形列表.map((s) => [...s]);
  for (const item of strokes) {
    const part = remaining[item.index];
    if (!part) continue;
    const from = item.from ?? 0;
    const to = item.to ?? part.length - 1;
    result.push(...part.slice(from, to + 1));
    remaining[item.index] = part.slice(to + 1);
  }
  return result;
}

export { 仿射变换, 图形盒子 };
