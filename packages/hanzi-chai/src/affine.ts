import { 区间 } from "./bezier.js";
import type {
  向量,
  矢量图形数据,
  矢量笔画数据,
  结构描述字符,
  绘制,
} from "./data.js";

class 仿射变换 {
  static idp: [区间, 区间] = [new 区间(0, 100), new 区间(0, 100)];
  static 查找表: Record<结构描述字符, [区间, 区间][]> = {
    "⿰": [
      [new 区间(0, 50), new 区间(0, 100)],
      [new 区间(50, 100), new 区间(0, 100)],
    ],
    "⿱": [
      [new 区间(0, 100), new 区间(0, 50)],
      [new 区间(0, 100), new 区间(50, 100)],
    ],
    "⿲": [
      [new 区间(0, 33), new 区间(0, 100)],
      [new 区间(33, 66), new 区间(0, 100)],
      [new 区间(66, 99), new 区间(0, 100)],
    ],
    "⿳": [
      [new 区间(0, 100), new 区间(0, 33)],
      [new 区间(0, 100), new 区间(33, 66)],
      [new 区间(0, 100), new 区间(66, 99)],
    ],
    "⿴": [this.idp, [new 区间(25, 75), new 区间(25, 75)]],
    "⿵": [this.idp, [new 区间(25, 75), new 区间(40, 90)]],
    "⿶": [this.idp, [new 区间(25, 75), new 区间(10, 60)]],
    "⿷": [this.idp, [new 区间(40, 90), new 区间(25, 75)]],
    "⿸": [this.idp, [new 区间(40, 90), new 区间(40, 90)]],
    "⿹": [this.idp, [new 区间(10, 60), new 区间(40, 90)]],
    "⿺": [this.idp, [new 区间(40, 90), new 区间(10, 60)]],
    "⿼": [this.idp, [new 区间(10, 60), new 区间(25, 75)]],
    "⿽": [this.idp, [new 区间(10, 60), new 区间(10, 60)]],
    "⿻": [this.idp, this.idp],
    "⿾": [this.idp],
    "⿿": [this.idp],
  };

  private readonly 横向缩放: number;
  private readonly 纵向缩放: number;
  private readonly 平移: 向量;

  public constructor(x区间: 区间, y区间: 区间) {
    this.横向缩放 = x区间.长度() / 100;
    this.纵向缩放 = y区间.长度() / 100;
    this.平移 = [x区间.起点(), y区间.起点()];
  }

  /**
   * 将原始坐标系中的绝对坐标点变换到目标坐标系
   */
  private 变换点(x: number, y: number): 向量 {
    return [
      Math.round(x * this.横向缩放) + this.平移[0],
      Math.round(y * this.纵向缩放) + this.平移[1],
    ];
  }

  /**
   * 变换一条笔画。
   *
   * 核心思路：先将原始坐标系下所有控制点的绝对坐标逐一通过变换点()
   * 变换到目标坐标系，再从变换后的相邻绝对坐标反推 SVG 的相对绘制参数。
   * 这样可以保证 "一条折线的终点 = 下一条折线的起点" 在取整后仍然成立，
   * 避免分别变换起点和各个相对参数时 Math.round 引入的累积误差。
   */
  public 变换笔画(笔画: 矢量笔画数据): 矢量笔画数据 {
    let [ox, oy] = 笔画.start; // 原始坐标系下的当前绝对位置
    const [startX, startY] = this.变换点(ox, oy); // 变换后的笔画起点
    let [nx, ny] = [startX, startY]; // 变换后坐标系下的当前绝对位置

    const newCurveList: 绘制[] = [];

    for (const cmd of 笔画.curveList) {
      switch (cmd.command) {
        case "h": {
          ox += cmd.parameterList[0];
          const [newX] = this.变换点(ox, oy);
          newCurveList.push({ command: "h", parameterList: [newX - nx] });
          nx = newX;
          break;
        }
        case "v": {
          oy += cmd.parameterList[0];
          const [, newY] = this.变换点(ox, oy);
          newCurveList.push({ command: "v", parameterList: [newY - ny] });
          ny = newY;
          break;
        }
        case "l": {
          ox += cmd.parameterList[0];
          oy += cmd.parameterList[1];
          const [newX, newY] = this.变换点(ox, oy);
          newCurveList.push({
            command: "l",
            parameterList: [newX - nx, newY - ny],
          });
          nx = newX;
          ny = newY;
          break;
        }
        case "c":
        case "z": {
          const [cx1, cy1, cx2, cy2, x, y] = cmd.parameterList;
          // 逐个变换三个绝对控制点
          const [ncx1, ncy1] = this.变换点(ox + cx1, oy + cy1);
          const [ncx2, ncy2] = this.变换点(ox + cx2, oy + cy2);
          ox += x;
          oy += y;
          const [newX, newY] = this.变换点(ox, oy);
          // 从变换后的绝对坐标反推相对参数
          newCurveList.push({
            command: cmd.command,
            parameterList: [
              ncx1 - nx,
              ncy1 - ny,
              ncx2 - nx,
              ncy2 - ny,
              newX - nx,
              newY - ny,
            ],
          });
          nx = newX;
          ny = newY;
          break;
        }
        case "a": {
          // 弧线（用于点/捺尖）不需要变换
          newCurveList.push(cmd);
          break;
        }
      }
    }

    return {
      ...笔画,
      start: [startX, startY] as 向量,
      curveList: newCurveList,
    };
  }

  public 变换笔画列表(glyph: 矢量图形数据): 矢量图形数据 {
    if (
      this.横向缩放 === 1 &&
      this.纵向缩放 === 1 &&
      this.平移[0] === 0 &&
      this.平移[1] === 0
    ) {
      return glyph;
    }
    return glyph.map((x) => this.变换笔画(x));
  }
}

class 图形盒子 {
  constructor(
    private 笔画列表: 矢量笔画数据[] = [],
    public 横向区间: 区间 = new 区间(0, 100),
    public 纵向区间: 区间 = new 区间(0, 100),
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
          case "l":
            x += parameterList[0];
            y += parameterList[1];
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
}

export { 仿射变换, 图形盒子 };
