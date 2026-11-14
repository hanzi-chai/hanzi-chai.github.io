import { isEqual } from "lodash-es";
import type { 笔画名称 } from "./classifier.js";
import type { 向量, 矢量笔画数据, 绘制 } from "./data.js";
import { 乘, 减, 加, 叉乘, 排序, 点乘, 距离, 除 } from "./math.js";

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

// 绝对控制点逐坐标取整时，每侧每轴最多偏差 0.5；接触双方每轴允许相差 1。
// 连接使用 L∞ 距离，与折线近似、求交验证的欧氏距离精度分开。
const 连接容差 = 1;
const 折线精度 = 1e-3;
const 数值误差 = 1e-8;

type 距离范数 = "欧氏" | "L∞";
const 网格距离 = (a: 向量, b: 向量): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

interface 曲线采样点 {
  坐标: 向量;
  参数: number;
}

interface 最近点 extends 曲线采样点 {
  距离: number;
}

/** 点到闭线段的最近点；欧氏距离下为投影，L∞ 距离下检查分段线性折点。 */
const 线段投影 = (
  点: 向量,
  起点: 向量,
  终点: 向量,
  范数: 距离范数 = "欧氏",
) => {
  const 方向 = 减(终点, 起点);
  if (范数 === "L∞") {
    const 偏移 = 减(起点, 点);
    let 最优: 最近点 = { 参数: 0, 坐标: 起点, 距离: 网格距离(点, 起点) };
    // max(|x(t)|, |y(t)|) 是分段线性凸函数，极小值在端点或这些折点上。
    const 候选 = [1];
    for (const [常数, 斜率] of [
      [偏移[0], 方向[0]],
      [偏移[1], 方向[1]],
      [偏移[0] - 偏移[1], 方向[0] - 方向[1]],
      [偏移[0] + 偏移[1], 方向[0] + 方向[1]],
    ] as const) {
      if (斜率 !== 0) 候选.push(Math.max(0, Math.min(1, -常数 / 斜率)));
    }
    for (const 参数 of 候选) {
      const 坐标 = 加(起点, 乘(参数, 方向));
      const 当前距离 = 网格距离(点, 坐标);
      if (当前距离 < 最优.距离) 最优 = { 参数, 坐标, 距离: 当前距离 };
    }
    return 最优;
  }
  const 长度平方 = 点乘(方向, 方向);
  const 参数 =
    长度平方 === 0
      ? 0
      : Math.max(0, Math.min(1, 点乘(减(点, 起点), 方向) / 长度平方));
  const 坐标 = 加(起点, 乘(参数, 方向));
  return { 参数, 坐标, 距离: 距离(点, 坐标) };
};

abstract class 曲线 {
  abstract 获取类型(): "linear" | "cubic" | "arc";
  abstract 获取朝向(): 朝向;
  abstract 获取起点和终点(): [向量, 向量];
  abstract 求值(t: number): 向量;

  abstract _controls(): 向量[];

  private 折线缓存?: 曲线采样点[];

  private 获取折线(): 曲线采样点[] {
    if (this.折线缓存) return this.折线缓存;
    const [起点, 终点] = this.获取起点和终点();
    const 结果: 曲线采样点[] = [{ 坐标: 起点, 参数: 0 }];
    if (this.获取类型() !== "cubic") {
      结果.push({ 坐标: 终点, 参数: 1 });
    } else {
      const 细分 = (p: 向量[], begin: number, end: number, depth: number) => {
        const [p0, p1, p2, p3] = p as [向量, 向量, 向量, 向量];
        if (
          depth === 20 ||
          Math.max(线段投影(p1, p0, p3).距离, 线段投影(p2, p0, p3).距离) <=
            折线精度
        ) {
          结果.push({ 坐标: p3, 参数: end });
          return;
        }
        const p01 = 除(加(p0, p1), 2),
          p12 = 除(加(p1, p2), 2),
          p23 = 除(加(p2, p3), 2);
        const p012 = 除(加(p01, p12), 2),
          p123 = 除(加(p12, p23), 2);
        const mid = 除(加(p012, p123), 2),
          t = (begin + end) / 2;
        细分([p0, p01, p012, mid], begin, t, depth + 1);
        细分([mid, p123, p23, p3], t, end, depth + 1);
      };
      细分(this._controls(), 0, 1, 0);
    }
    this.折线缓存 = 结果;
    return 结果;
  }

  private 求导(t: number): 向量 {
    const p = this._controls();
    if (this.获取类型() !== "cubic") return 减(p[1]!, p[0]!);
    const [a, b, c, d] = p as [向量, 向量, 向量, 向量];
    return 加(
      加(乘(3 * (1 - t) ** 2, 减(b, a)), 乘(6 * (1 - t) * t, 减(c, b))),
      乘(3 * t ** 2, 减(d, c)),
    );
  }

  /** 先用自适应折线定位，再在原曲线上细化，避免折线误差决定容差边界。 */
  寻找最近点(点: 向量, 范数: 距离范数 = "欧氏"): 最近点 {
    const 距离函数 = 范数 === "L∞" ? 网格距离 : 距离;
    const 折线 = this.获取折线();
    if (this.获取类型() !== "cubic")
      return 线段投影(点, 折线[0]!.坐标, 折线[1]!.坐标, 范数);
    let 最近线段 = 1,
      最小距离 = Infinity;
    for (let i = 1; i < 折线.length; i++) {
      const a = 折线[i - 1]!,
        b = 折线[i]!;
      const 投影 = 线段投影(点, a.坐标, b.坐标, 范数);
      if (投影.距离 < 最小距离) {
        最近线段 = i;
        最小距离 = 投影.距离;
      }
    }
    const 取点 = (参数: number): 最近点 => {
      const 坐标 = this.求值(参数);
      return { 参数, 坐标, 距离: 距离函数(点, 坐标) };
    };
    // 纳入相邻线段，避免折线投影恰好落在细分边界。
    let lo = 折线[Math.max(0, 最近线段 - 2)]!.参数;
    let hi = 折线[Math.min(折线.length - 1, 最近线段 + 1)]!.参数;
    const 比例 = (Math.sqrt(5) - 1) / 2;
    let left = 取点(hi - 比例 * (hi - lo)),
      right = 取点(lo + 比例 * (hi - lo));
    let 最优 = [取点(lo), 取点(hi)].sort((a, b) => a.距离 - b.距离)[0]!;
    for (let i = 0; i < 48; i++) {
      if (left.距离 < 最优.距离) 最优 = left;
      if (right.距离 < 最优.距离) 最优 = right;
      if (left.距离 <= right.距离) {
        hi = right.参数;
        right = left;
        left = 取点(hi - 比例 * (hi - lo));
      } else {
        lo = left.参数;
        left = right;
        right = 取点(lo + 比例 * (hi - lo));
      }
    }
    return 最优;
  }

  private 判断位置(点: 向量): 相连关系["first"] {
    const [起点, 终点] = this.获取起点和终点();
    const 前距 = 网格距离(点, 起点),
      后距 = 网格距离(点, 终点);
    if (Math.min(前距, 后距) > 连接容差 + 数值误差) return "中";
    return 前距 <= 后距 ? "前" : "后";
  }

  /** 沿折线的 L∞ 弧长向内走四倍容差仍贴着对方时，不吸附成连接。 */
  private 是局部接触(c: 曲线, 端点: number): boolean {
    const 折线 = this.获取折线();
    let 剩余 = 4 * 连接容差;
    for (let i = 1; i < 折线.length; i++) {
      const a = 折线[端点 === 0 ? i - 1 : 折线.length - i]!;
      const b = 折线[端点 === 0 ? i : 折线.length - i - 1]!;
      const 长 = 网格距离(a.坐标, b.坐标);
      if (长 >= 剩余 || i === 折线.length - 1) {
        const 比例 = 长 === 0 ? 0 : Math.min(1, 剩余 / 长);
        const 点 = 加(a.坐标, 乘(比例, 减(b.坐标, a.坐标)));
        return c.寻找最近点(点, "L∞").距离 > 连接容差 + 数值误差;
      }
      剩余 -= 长;
    }
    return false;
  }

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
    const 相连 = this.计算相连关系(c);
    if (相连) return 相连;
    const 交点 = this.寻找交点(c);
    if (交点 === undefined) return this.计算离散关系(c);
    const first = this.判断位置(交点),
      second = c.判断位置(交点);
    if (first !== "中" || second !== "中") return 构造相连(first, second);
    return { type: "交" };
  }

  private 计算相连关系(c: 曲线): 相连关系 | undefined {
    const [astart, aend] = this.获取起点和终点();
    const [bstart, bend] = c.获取起点和终点();
    if (isEqual(astart, bstart)) return 构造相连("前", "前");
    if (isEqual(astart, bend)) return 构造相连("前", "后");
    if (isEqual(aend, bstart)) return 构造相连("后", "前");
    if (isEqual(aend, bend)) return 构造相连("后", "后");
    const 候选: { 关系: 相连关系; 距离: number; 坐标: number[] }[] = [];
    for (const [a, b, 反向] of [
      [this, c, false],
      [c, this, true],
    ] as const) {
      for (const [索引, 点] of a.获取起点和终点().entries()) {
        const [x, y] = b.获取区间();
        const 边界容差 = 连接容差 + 数值误差;
        if (
          点[0] < x.起点() - 边界容差 ||
          点[0] > x.终点() + 边界容差 ||
          点[1] < y.起点() - 边界容差 ||
          点[1] > y.终点() + 边界容差
        )
          continue;
        const 最近 = b.寻找最近点(点, "L∞");
        if (最近.距离 > 连接容差 + 数值误差) continue;
        if (最近.距离 > 数值误差 && !a.是局部接触(b, 索引)) continue;
        const first = 索引 === 0 ? "前" : "后",
          // 双方端点是否相接也按原端点的网格距离判断，避免最近点沿斜线偏移。
          second = b.判断位置(点);
        // 排序键不依赖比较方向，距离相同也能选中同一个接触事件。
        const 坐标 = [点, 最近.坐标]
          .sort((x, y) => x[0] - y[0] || x[1] - y[1])
          .flat();
        候选.push({
          关系: 反向 ? 构造相连(second, first) : 构造相连(first, second),
          距离: 最近.距离,
          坐标,
        });
      }
    }
    候选.sort(
      (a, b) =>
        a.距离 - b.距离 || a.坐标.reduce((r, v, i) => r || v - b.坐标[i]!, 0),
    );
    return 候选[0]?.关系;
  }

  private 计算离散关系(c: 曲线): 离散关系 {
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
   * 折线只生成交叉候选；必须在原曲线上收敛并验证，不能以包围盒重叠代替相交。
   */
  寻找交点(c: 曲线): 向量 | undefined {
    const [axInterval, ayInterval] = this.获取区间();
    const [bxInterval, byInterval] = c.获取区间();
    const xposition = axInterval.比较(bxInterval);
    const yposition = ayInterval.比较(byInterval);
    const disjoint = [区间关系.先于, 区间关系.后于];
    if (disjoint.includes(xposition) || disjoint.includes(yposition))
      return undefined;
    const a = this.获取折线(),
      b = c.获取折线();
    for (let i = 1; i < a.length; i++) {
      for (let j = 1; j < b.length; j++) {
        const a0 = a[i - 1]!,
          a1 = a[i]!,
          b0 = b[j - 1]!,
          b1 = b[j]!;
        const v = 减(a1.坐标, a0.坐标),
          w = 减(b1.坐标, b0.坐标);
        const 分母 = 叉乘(v, w);
        if (
          Math.abs(分母) <=
          Number.EPSILON * 距离(a0.坐标, a1.坐标) * 距离(b0.坐标, b1.坐标)
        )
          continue;
        const 偏移 = 减(b0.坐标, a0.坐标);
        const ta = 叉乘(偏移, w) / 分母,
          tb = 叉乘(偏移, v) / 分母;
        if (ta < 0 || ta > 1 || tb < 0 || tb > 1) continue;
        // 直线形状的三次曲线也可能速度不均，不能将弦上的比例当作原曲线参数。
        const 初值 = 加(a0.坐标, 乘(ta, v));
        let t = this.寻找最近点(初值).参数,
          u = c.寻找最近点(初值).参数;
        for (let k = 0; k < 12; k++) {
          const p = this.求值(t),
            q = c.求值(u),
            偏差 = 减(p, q);
          if (距离(p, q) <= 数值误差) return 除(加(p, q), 2);
          const da = this.求导(t),
            db = c.求导(u),
            det = 叉乘(da, db);
          if (Math.abs(det) <= 1e-12 * Math.hypot(...da) * Math.hypot(...db))
            break;
          const nt = t - 叉乘(偏差, db) / det,
            nu = u - 叉乘(偏差, da) / det;
          if (nt < 0 || nt > 1 || nu < 0 || nu > 1) break;
          t = nt;
          u = nu;
        }
      }
    }
    return undefined;
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
      case "l":
        p1 = 加(start, draw.parameterList);
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
  获取起点和终点(): [向量, 向量] {
    return [this.controls[0], this.controls[1]];
  }
  求值(t: number): 向量 {
    return 加(
      乘(1 - t, this.controls[0]) as 向量,
      乘(t, this.controls[1]) as 向量,
    );
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
  获取起点和终点(): [向量, 向量] {
    return [this.controls[0], this.controls[3]];
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
  toArray(): [number, number] {
    return [this.start, this.end];
  }
}

type 笔画关系 = 曲线关系[];
type 笔画交连关系 = (相交关系 | 相连关系) & { index1: number; index2: number };

interface 笔画关系结果 {
  详细关系: 笔画关系;
  交连关系: 笔画交连关系 | undefined;
  同向: boolean;
}

/**
 * 两个连通子图整体之间的关系
 * 每个子图取其全部曲线的包络区间，在横纵两个方向上分别比较
 */
interface 子图关系 {
  x: 区间关系;
  y: 区间关系;
}

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

  计算关系(stroke2: 笔画图形): 笔画关系结果 {
    const 详细关系: 笔画关系 = [];
    let 交连关系: 笔画关系结果["交连关系"];
    let 有同向曲线 = false;
    for (const [index1, curve1] of this.curveList.entries()) {
      for (const [index2, curve2] of stroke2.curveList.entries()) {
        const current = curve1.计算关系(curve2);
        详细关系.push(current);
        if (current.type === "交" || current.type === "连") {
          // 交优先于连；同级关系保留按曲线索引遍历遇到的第一个。
          if (
            交连关系 === undefined ||
            (交连关系.type === "连" && current.type === "交")
          ) {
            交连关系 = { ...current, index1, index2 };
          }
        } else if (current.type === "平行" && current.mainAxis === 0) {
          有同向曲线 = true;
        }
      }
    }
    return { 详细关系, 交连关系, 同向: 交连关系 === undefined && 有同向曲线 };
  }
}

class 拓扑 {
  关系矩阵: 笔画关系[][];
  新关系矩阵: (笔画交连关系 | undefined)[][];
  同向笔画对: [number, number][];
  划分: number[][];
  子图关系矩阵: 子图关系[][];

  constructor(部件图形: 笔画图形[]) {
    this.关系矩阵 = [];
    this.新关系矩阵 = [];
    this.同向笔画对 = [];
    for (const [index1, stroke1] of 部件图形.entries()) {
      const 详细行: 笔画关系[] = [];
      const 交连行: (笔画交连关系 | undefined)[] = [];
      for (const [index2, stroke2] of 部件图形.entries()) {
        if (index1 === index2) {
          详细行.push([]);
          交连行.push(undefined);
          continue;
        }
        const result = stroke1.计算关系(stroke2);
        详细行.push(result.详细关系);
        交连行.push(result.交连关系);
        if (index2 < index1 && result.同向) {
          this.同向笔画对.push([index1, index2]);
        }
      }
      this.关系矩阵.push(详细行);
      this.新关系矩阵.push(交连行);
    }
    this.划分 = 拓扑.划分连通子图(this.新关系矩阵);
    this.子图关系矩阵 = 拓扑.计算子图关系(this.划分, 部件图形);
  }

  /**
   * 将笔画按照交连关系划分为若干连通子图
   * 子图内的笔画通过交连关系连成一体，不同子图之间不存在任何交连关系
   * 子图按照首笔的先后排列，子图内的笔画索引保持递增
   */
  static 划分连通子图(
    新关系矩阵: (相交关系 | 相连关系 | undefined)[][],
  ): number[][] {
    const n = 新关系矩阵.length;
    const parent = [...Array(n).keys()];
    const find = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]!]!;
        i = parent[i]!;
      }
      return i;
    };
    const union = (i: number, j: number) => {
      const [rootI, rootJ] = [find(i), find(j)];
      if (rootI !== rootJ) parent[rootI] = rootJ;
    };
    for (let i = 0; i < n; ++i) {
      for (let j = 0; j < i; ++j) {
        const relation = 新关系矩阵[i]![j];
        if (relation !== undefined) union(i, j);
      }
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; ++i) {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(i);
    }
    return [...groups.values()];
  }

  /**
   * 计算子图整体之间的离散关系
   * 每个子图取其全部曲线的包络区间，两个子图的关系就是包络区间在横纵两个方向上的比较
   */
  static 计算子图关系(划分: number[][], 部件图形: 笔画图形[]): 子图关系[][] {
    const 子图区间列表 = 划分.map((indices) => {
      let x: 区间 | undefined;
      let y: 区间 | undefined;
      for (const i of indices) {
        for (const curve of 部件图形[i]!.curveList) {
          const [curveX, curveY] = curve.获取区间();
          x = x === undefined ? curveX : x.取并集(curveX);
          y = y === undefined ? curveY : y.取并集(curveY);
        }
      }
      return [x!, y!] as [区间, 区间];
    });
    return 子图区间列表.map(([ax, ay]) =>
      子图区间列表.map(([bx, by]) => ({ x: ax.比较(bx), y: ay.比较(by) })),
    );
  }

  验证子图关系(部件图形: 笔画图形[], 部件拓扑: 拓扑, 切片: number[]): boolean {
    const 部件子图形 = 切片.map((i) => 部件图形[i]!);
    const 部件子新关系矩阵 = 切片.map((i) =>
      切片.map((j) => 部件拓扑.新关系矩阵[i]![j]),
    );
    const 部件子划分 = 拓扑.划分连通子图(部件子新关系矩阵);
    const 部件子图关系矩阵 = 拓扑.计算子图关系(部件子划分, 部件子图形);
    return (
      isEqual(部件子划分, this.划分) &&
      isEqual(部件子图关系矩阵, this.子图关系矩阵)
    );
  }
}

export type { 子图关系, 曲线关系, 笔画交连关系, 笔画关系 };
export {
  一次曲线,
  三次曲线,
  创建曲线,
  区间,
  区间关系,
  圆弧曲线,
  拓扑,
  曲线,
  笔画图形,
};
