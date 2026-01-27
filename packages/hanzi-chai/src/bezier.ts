import { isEqual } from "lodash-es";
import type { 笔画名称 } from "./classifier.js";
import type { 绘制, 向量, 矢量笔画数据 } from "./data.js";
import { 加, 叉乘, 距离, 除, 是共线, 乘, 排序, 减 } from "./math.js";

/**
 * 一段 Bezier 曲线的主要朝向
 * 例如，横笔画的朝向是水平的，竖笔画的朝向是垂直的
 * 而撇和捺笔画的朝向可能是水平或垂直的，取决于它是平撇还是撇、平捺还是捺
 */
type 朝向 = "horizontal" | "vertical";

interface 相交关系 {
  type: "交";
}

interface 相连关系 {
  type: "连";
  first: "前" | "中" | "后";
  second: "前" | "中" | "后";
}

const 构造相连 = (
  first: 相连关系["first"],
  second: 相连关系["second"],
): 相连关系 => ({ type: "连", first, second });

interface 平行离散关系 {
  type: "平行";
  mainAxis: 区间关系;
  crossAxis: 区间关系;
}

interface 垂直离散关系 {
  type: "垂直";
  x: 区间关系;
  y: 区间关系;
}

type 离散关系 = 平行离散关系 | 垂直离散关系;
type 曲线关系 = 相交关系 | 相连关系 | 离散关系;

abstract class 曲线 {
  abstract 获取类型(): "linear" | "cubic" | "arc";
  abstract 获取朝向(): 朝向;
  abstract 获取起点和终点(): [向量, 向量];
  abstract 求值(t: number): 向量;
  abstract 二分(): [曲线, 曲线];

  abstract _controls(): 向量[];

  获取区间(): [区间, 区间] {
    const [start, end] = this.获取起点和终点();
    const x = new 区间(start[0], end[0]);
    const y = new 区间(start[1], end[1]);
    return [x, y];
  }

  获取主轴和副轴区间(): [区间, 区间] {
    const [x, y] = this.获取区间();
    return this.获取朝向() === "horizontal" ? [x, y] : [y, x];
  }

  长度(): number {
    const [start, end] = this.获取起点和终点();
    return 距离(start, end);
  }

  是被区间包围(xrange: 区间, yrange: 区间): boolean {
    const [x, y] = this.获取区间();
    return xrange.包含(x) && yrange.包含(y);
  }

  计算关系(c: 曲线): 曲线关系 {
    const relation = this.计算相连关系(c);
    if (relation !== undefined) return relation;
    if (this instanceof 一次曲线 && c instanceof 一次曲线) {
      return this.计算线性一般关系(c);
    }
    return this.计算一般关系(c);
  }

  计算相连关系(c: 曲线): 相连关系 | undefined {
    const [astart, aend] = this.获取起点和终点();
    const [bstart, bend] = c.获取起点和终点();
    if (isEqual(astart, bstart)) return 构造相连("前", "前");
    if (isEqual(astart, bend)) return 构造相连("前", "后");
    if (isEqual(aend, bstart)) return 构造相连("后", "前");
    if (isEqual(aend, bend)) return 构造相连("后", "后");
    if (this.获取类型() === "linear") {
      if (是共线(astart, aend, bstart)) return 构造相连("中", "前");
      if (是共线(astart, aend, bend)) return 构造相连("中", "后");
    }
    if (c.获取类型() === "linear") {
      if (是共线(bstart, bend, astart)) return 构造相连("前", "中");
      if (是共线(bstart, bend, aend)) return 构造相连("后", "中");
    }
  }

  计算一般关系(c: 曲线): 曲线关系 {
    const 交点 = this.寻找交点(c);
    if (交点 === undefined) return this.计算离散关系(c);
    const [起点, 终点] = this.获取起点和终点();
    const [另一起点, 另一终点] = c.获取起点和终点();
    const 相连误差 = 3;
    if (距离(交点, 起点) < 相连误差) return 构造相连("前", "中");
    if (距离(交点, 终点) < 相连误差) return 构造相连("后", "中");
    if (距离(交点, 另一起点) < 相连误差) return 构造相连("中", "前");
    if (距离(交点, 另一终点) < 相连误差) return 构造相连("中", "后");
    return { type: "交" };
  }

  计算离散关系(c: 曲线): 离散关系 {
    if (this.获取朝向() === c.获取朝向()) {
      const [amain, across] = this.获取主轴和副轴区间();
      const [bmain, bcross] = c.获取主轴和副轴区间();
      return {
        type: "平行",
        mainAxis: amain.比较(bmain),
        crossAxis: across.比较(bcross),
      };
    } else {
      const [ax, ay] = this.获取区间();
      const [bx, by] = c.获取区间();
      return {
        type: "垂直",
        x: ax.比较(bx),
        y: ay.比较(by),
      };
    }
  }

  /**
   * 获取两个曲线在 t 取值上的交点
   */
  寻找交点(c: 曲线): 向量 | undefined {
    const [astart, aend] = this.获取起点和终点();
    const [bstart, bend] = c.获取起点和终点();
    const [axInterval, ayInterval] = this.获取区间();
    const [bxInterval, byInterval] = c.获取区间();
    const xposition = axInterval.比较(bxInterval);
    const yposition = ayInterval.比较(byInterval);
    const disjoint = [区间关系.先于, 区间关系.后于];
    if (disjoint.includes(xposition) || disjoint.includes(yposition))
      return undefined;
    const [alength, blength] = [距离(astart, aend), 距离(bstart, bend)];
    const threshold = 1;
    if (alength < threshold && blength < threshold)
      return 除(加(加(astart, aend), 加(bstart, bend)), 4);
    const [a_firsthalf, a_secondhalf] = this.二分();
    const [b_firsthalf, b_secondhalf] = c.二分();
    return (
      a_firsthalf.寻找交点(b_firsthalf) ||
      a_firsthalf.寻找交点(b_secondhalf) ||
      a_secondhalf.寻找交点(b_firsthalf) ||
      a_secondhalf.寻找交点(b_secondhalf)
    );
  }
}

/**
 * 一次 Bezier 曲线
 * 用于表示横、竖等笔画
 */
class 一次曲线 extends 曲线 {
  constructor(
    private orientation: 朝向,
    private controls: [向量, 向量],
  ) {
    super();
  }

  _controls(): 向量[] {
    return this.controls;
  }

  static 从绘制创建(start: 向量, draw: 绘制) {
    let p1: 向量;
    switch (draw.command) {
      case "h":
        p1 = 加(start, [draw.parameterList[0], 0]);
        break;
      default:
        p1 = 加(start, [0, draw.parameterList[0]]);
        break;
    }
    const orientation = draw.command === "v" ? "vertical" : "horizontal";
    return new 一次曲线(orientation, [start, p1]);
  }

  获取类型() {
    return "linear" as const;
  }
  获取朝向() {
    return this.orientation;
  }
  复制(): 一次曲线 {
    return new 一次曲线(this.orientation, structuredClone(this.controls));
  }

  二分(): [曲线, 曲线] {
    const mid = this.求值(0.5);
    const firstHalf = this.复制();
    const secondHalf = this.复制();
    firstHalf.controls[1] = mid;
    secondHalf.controls[0] = mid;
    return [firstHalf, secondHalf];
  }
  获取起点和终点(): [向量, 向量] {
    return [this.controls[0], this.controls[1]];
  }
  求值(t: number): 向量 {
    return 加(
      乘(1 - t, this.controls[0]) as 向量,
      乘(t, this.controls[1]) as 向量,
    );
  }

  计算线性一般关系(b: 一次曲线): 曲线关系 {
    const [astart, aend] = this.controls;
    const [bstart, bend] = b.controls;
    const [v, v1, v2] = [
      减(aend, astart),
      减(bstart, astart),
      减(bend, astart),
    ];
    const vc = 叉乘(v, v1) * 叉乘(v, v2);
    const [u, u1, u2] = [
      减(bend, bstart),
      减(astart, bstart),
      减(aend, bstart),
    ];
    const uc = 叉乘(u, u1) * 叉乘(u, u2);
    if (vc < 0 && uc < 0) {
      return { type: "交" };
    }
    return this.计算离散关系(b);
  }
}

/**
 * 三次 Bezier 曲线
 * 用于表示撇、捺等笔画
 */
class 三次曲线 extends 曲线 {
  constructor(
    private orientation: 朝向,
    private controls: [向量, 向量, 向量, 向量],
  ) {
    super();
  }

  _controls(): 向量[] {
    return this.controls;
  }

  static 从绘制创建(start: 向量, draw: 绘制) {
    const p1 = 加(start, draw.parameterList.slice(0, 2) as 向量);
    const p2 = 加(start, draw.parameterList.slice(2, 4) as 向量);
    const p3 = 加(start, draw.parameterList.slice(4) as 向量);
    const orientation = draw.command === "c" ? "vertical" : "horizontal";
    return new 三次曲线(orientation, [start, p1, p2, p3]);
  }
  获取类型() {
    return "cubic" as const;
  }
  获取朝向() {
    return this.orientation;
  }
  复制(): 三次曲线 {
    return new 三次曲线(this.orientation, structuredClone(this.controls));
  }
  获取起点和终点(): [向量, 向量] {
    return [this.controls[0], this.controls[3]];
  }
  二分(): [曲线, 曲线] {
    const [p0, p1, p2, p3] = this.controls;
    const p01 = 除(加(p0, p1), 2);
    const p12 = 除(加(p1, p2), 2);
    const p23 = 除(加(p2, p3), 2);
    const p012 = 除(加(p01, p12), 2);
    const p123 = 除(加(p12, p23), 2);
    const p0123 = 除(加(p012, p123), 2);
    const firstHalf = this.复制();
    const secondHalf = this.复制();
    firstHalf.controls = [p0, p01, p012, p0123];
    secondHalf.controls = [p0123, p123, p23, p3];
    return [firstHalf, secondHalf];
  }
  求值(t: number) {
    const v01 = 加(
      乘((1 - t) ** 3, this.controls[0]),
      乘(3 * (1 - t) ** 2 * t, this.controls[1]),
    );
    const v23 = 加(
      乘(3 * (1 - t) * t ** 2, this.controls[2]),
      乘(t ** 3, this.controls[3]),
    );
    return 加(v01, v23);
  }
}

/**
 * 圆弧曲线
 * 用于表示笔画「圈」
 */
class 圆弧曲线 extends 曲线 {
  constructor(
    private orientation: 朝向,
    private controls: [向量, 向量],
  ) {
    super();
  }

  _controls(): 向量[] {
    return this.controls;
  }

  static 从绘制创建(start: 向量, _: 绘制) {
    const orientation = "horizontal";
    return new 圆弧曲线(orientation, [start, start]);
  }

  获取类型() {
    return "arc" as const;
  }
  获取朝向() {
    return this.orientation;
  }
  求值(_: number): 向量 {
    return [0, 0];
  }
  获取起点和终点(): [向量, 向量] {
    return [this.controls[0], this.controls[1]];
  }
  二分(): [曲线, 曲线] {
    const mid = this.求值(0.5);
    const firstHalf = structuredClone(this);
    const secondHalf = structuredClone(this);
    firstHalf.controls[1] = mid;
    secondHalf.controls[0] = mid;
    return [firstHalf, secondHalf];
  }
}

const 创建曲线 = (start: 向量, draw: 绘制): 曲线 => {
  if (draw.command === "a") {
    return 圆弧曲线.从绘制创建(start, draw);
  }
  if (draw.command === "c" || draw.command === "z") {
    return 三次曲线.从绘制创建(start, draw);
  }
  return 一次曲线.从绘制创建(start, draw);
};

enum 区间关系 {
  先于 = -1,
  部分先于 = -0.5,
  重叠 = 0,
  部分后于 = 0.5,
  后于 = 1,
}

class 区间 {
  private start: number;
  private end: number;

  constructor(a: number, b: number) {
    [this.start, this.end] = 排序(a, b);
  }
  比较(other: 区间): 区间关系 {
    // totally disjoint
    if (this.end < other.start) return 区间关系.先于;
    if (this.start > other.end) return 区间关系.后于;
    // generally smaller or larger
    if (this.start < other.start && this.end < other.end)
      return 区间关系.部分先于;
    if (this.start > other.start && this.end > other.end)
      return 区间关系.部分后于;
    return 区间关系.重叠;
  }
  包含(other: 区间): boolean {
    return this.start <= other.start && this.end >= other.end;
  }
  长度(): number {
    return this.end - this.start;
  }
  取并集(other: 区间): 区间 {
    return new 区间(
      Math.min(this.start, other.start),
      Math.max(this.end, other.end),
    );
  }
  起点(): number {
    return this.start;
  }
  终点(): number {
    return this.end;
  }
  延长(amount: number) {
    this.end += amount;
  }
}

type 笔画关系 = 曲线关系[];

/**
 * 渲染后的笔画
 * 这个类型和 SVGStroke 的区别是，这个类型包含了一系列 Bezier 曲线，而 SVGStroke 包含了一系列 SVG 命令
 * Bezier 曲线里每一段的起点和终点都是显式写出的，所以比较适合于计算
 */
class 笔画图形 {
  feature: 笔画名称;
  curveList: 曲线[];

  constructor({ feature, start, curveList }: 矢量笔画数据) {
    this.feature = feature;
    this.curveList = [];
    let previousPosition = start;
    for (const draw of curveList) {
      const curve = 创建曲线(previousPosition, draw);
      previousPosition = curve.求值(1);
      this.curveList.push(curve);
    }
  }

  isBoundedBy(xrange: 区间, yrange: 区间): boolean {
    return this.curveList.every((x) => x.是被区间包围(xrange, yrange));
  }

  relation(stroke2: 笔画图形): 笔画关系 {
    const strokeRelation: 笔画关系 = [];
    for (const curve1 of this.curveList) {
      for (const curve2 of stroke2.curveList) {
        strokeRelation.push(curve1.计算关系(curve2));
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

export { 创建曲线, 区间, 拓扑, 曲线, 一次曲线, 三次曲线, 圆弧曲线, 笔画图形 };
export type { 曲线关系, 笔画关系 };
