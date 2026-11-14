import { describe, expect, it, spyOn } from "bun:test";
import {
  一次曲线,
  三次曲线,
  拓扑,
  曲线,
  type 曲线关系,
  笔画图形,
} from "../src/bezier.js";
import type { 向量 } from "../src/data.js";

const 直线 = (a: 向量, b: 向量) => new 一次曲线("horizontal", [a, b]);
const 三次直线 = (a: 向量, b: 向量) =>
  new 三次曲线("horizontal", [
    a,
    [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
    [a[0] + (2 * (b[0] - a[0])) / 3, a[1] + (2 * (b[1] - a[1])) / 3],
    b,
  ]);

function 反向关系(r: 曲线关系): 曲线关系 {
  if (r.type === "连") return { type: "连", first: r.second, second: r.first };
  if (r.type === "平行")
    return {
      type: "平行",
      mainAxis: -r.mainAxis || 0,
      crossAxis: -r.crossAxis || 0,
    };
  if (r.type === "垂直") return { type: "垂直", x: -r.x || 0, y: -r.y || 0 };
  return r;
}

describe("整数坐标下的曲线交连", () => {
  it("L∞ 最近点直接最小化横纵偏差的最大值，不套用欧氏投影", () => {
    for (const 构造 of [直线, 三次直线]) {
      const a = 构造([0, 0], [30, 15]);
      const 最近 = a.寻找最近点([15, 0], "L∞");
      expect(最近.距离).toBeCloseTo(5, 8);
      expect(最近.坐标[0]).toBeCloseTo(10, 7);
      expect(最近.坐标[1]).toBeCloseTo(5, 7);
      // 欧氏最近点为 (12, 6)，其 L∞ 距离反而是 6。
      expect(a.寻找最近点([15, 0]).坐标[0]).toBeCloseTo(12, 6);
      expect(a.寻找最近点([15, 0]).坐标[1]).toBeCloseTo(6, 6);
    }
  });

  it("双方每轴相差 1 的对角端点仍相连，镜像和交换方向保持一致", () => {
    for (const 构造甲 of [直线, 三次直线]) {
      for (const 构造乙 of [直线, 三次直线]) {
        for (const sx of [-1, 1])
          for (const sy of [-1, 1]) {
            const a = 构造甲([0, 0], [30 * sx, 0]);
            const b = 构造乙([31 * sx, sy], [31 * sx, 31 * sy]);
            expect(a.计算关系(b)).toEqual({
              type: "连",
              first: "后",
              second: "前",
            });
            expect(b.计算关系(a)).toEqual({
              type: "连",
              first: "前",
              second: "后",
            });
          }
      }
    }
  });

  it("任一坐标轴超过 1 就不吸附，即使仍处于旧的 3 单位容差内", () => {
    for (const 构造 of [直线, 三次直线]) {
      const a = 构造([0, 0], [30, 0]);
      for (const [dx, dy] of [
        [1.0001, 1],
        [1, 1.0001],
        [2, 0],
        [0, 2],
      ] as const) {
        const b = 构造([30 + dx, dy], [30 + dx, 30 + dy]);
        expect(a.计算关系(b).type).toBe("平行");
        expect(b.计算关系(a).type).toBe("平行");
      }
    }
  });

  it("端点到曲线在 L∞ 下相距 1 时连接，欧氏最近点超出方形邻域也不漏判", () => {
    for (const 构造甲 of [直线, 三次直线]) {
      for (const 构造乙 of [直线, 三次直线]) {
        const a = 构造甲([3, -30], [3, 0]);
        const b = 构造乙([0, 0], [30, 15]);
        expect(a.计算关系(b)).toEqual({
          type: "连",
          first: "后",
          second: "中",
        });
        expect(b.计算关系(a)).toEqual({
          type: "连",
          first: "中",
          second: "后",
        });
      }
    }
  });

  it("斜线最近点偏离端部时，仍按双方原端点确定端端连接", () => {
    for (const 构造 of [直线, 三次直线]) {
      const a = 构造([1, 31], [1, 1]),
        b = 构造([0, 0], [30, 15]);
      expect(b.寻找最近点([1, 1], "L∞").坐标[0]).toBeGreaterThan(1);
      expect(a.计算关系(b)).toEqual({ type: "连", first: "后", second: "前" });
      expect(b.计算关系(a)).toEqual({ type: "连", first: "前", second: "后" });
    }
  });

  it("短缺、精确接触和轻微越过都按连接处理，直线与三次曲线共用规则", () => {
    for (const 构造甲 of [直线, 三次直线]) {
      for (const 构造乙 of [直线, 三次直线]) {
        const a = 构造甲([50, 10], [50, 100]);
        for (const y of [9, 10, 11]) {
          const b = 构造乙([10, y], [100, y]);
          expect(a.计算关系(b)).toEqual({
            type: "连",
            first: "前",
            second: "中",
          });
          expect(b.计算关系(a)).toEqual({
            type: "连",
            first: "中",
            second: "前",
          });
        }
        expect(a.计算关系(构造乙([10, 14], [100, 14]))).toEqual({ type: "交" });
        expect(a.计算关系(构造乙([10, 6], [100, 6])).type).toBe("平行");
      }
    }
  });

  it("同时确定双方端部，交换比较方向后正确互换", () => {
    for (const 构造 of [直线, 三次直线]) {
      const a = 构造([0, 0], [30, 0]),
        b = 构造([31, 0], [31, 30]);
      expect(a.计算关系(b)).toEqual({ type: "连", first: "后", second: "前" });
      expect(b.计算关系(a)).toEqual({ type: "连", first: "前", second: "后" });
    }
  });

  it("用到原曲线的距离判断端点接近，而不是到端点弦的距离", () => {
    const a = new 三次曲线("vertical", [
      [0, 0],
      [0, 30],
      [30, 60],
      [30, 90],
    ]);
    const b = 直线([-30, 45], [14, 45]);
    expect(a.计算关系(b)).toEqual({ type: "连", first: "中", second: "后" });
    expect(a.计算关系(直线([-30, 45], [11, 45])).type).toBe("垂直");
    const 交点 = a.寻找交点(直线([-30, 45], [30, 45]));
    expect(交点?.[0]).toBeCloseTo(15, 7);
    expect(交点?.[1]).toBeCloseTo(45, 7);
  });

  it("整数参数的长距离近邻并行不会被包围盒重叠误判为交或吸附成连", () => {
    const a = new 三次曲线("vertical", [
      [10, 10],
      [30, 30],
      [70, 70],
      [90, 90],
    ]);
    const b = new 三次曲线("vertical", [
      [10, 11],
      [30, 31],
      [70, 71],
      [90, 91],
    ]);
    expect(a.寻找交点(b)).toBeUndefined();
    expect(a.计算关系(b).type).toBe("平行");
    expect(b.计算关系(a)).toEqual(反向关系(a.计算关系(b)));
  });

  it("弦的比例不等于三次曲线的参数，求最近点和交点仍然收敛", () => {
    const a = new 三次曲线("vertical", [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 30],
    ]);
    const 最近 = a.寻找最近点([1, 1]);
    expect(最近.距离).toBeCloseTo(1, 8);
    expect(最近.坐标[1]).toBeCloseTo(1, 7);
    expect(最近.参数).toBeCloseTo(Math.cbrt(1 / 30), 7);
    expect(a.计算关系(直线([-15, -1], [15, -1]))).toEqual({
      type: "连",
      first: "前",
      second: "中",
    });
    expect(a.计算关系(直线([-15, 1], [15, 1]))).toEqual({
      type: "连",
      first: "前",
      second: "中",
    });
    const 交点 = a.寻找交点(直线([-15, 5], [15, 5]));
    expect(交点?.[0]).toBeCloseTo(0, 7);
    expect(交点?.[1]).toBeCloseTo(5, 7);
  });

  it("内部交点的切线平行时，不因牛顿迭代的分母为零而漏判", () => {
    const a = new 三次曲线("horizontal", [
      [0, -30],
      [10, 30],
      [20, -30],
      [30, 30],
    ]);
    const b = 直线([0, 0], [30, 0]);
    expect(a.计算关系(b)).toEqual({ type: "交" });
    expect(b.计算关系(a)).toEqual({ type: "交" });
  });

  it("零长度笔段的最近点和关系保持有限", () => {
    const a = 直线([10, 10], [10, 10]);
    expect(a.寻找最近点([13, 14])).toEqual({
      坐标: [10, 10],
      参数: 0,
      距离: 5,
    });
    expect(a.寻找交点(直线([0, 0], [30, 30]))).toBeUndefined();
    expect(a.计算关系(直线([0, 10], [30, 10]))).toEqual({
      type: "连",
      first: "前",
      second: "中",
    });
  });

  it("不同位置和朝向的比较满足交换对称性", () => {
    const curves: 曲线[] = [];
    for (let i = 0; i < 12; i++) {
      curves.push(直线([i, 0], [30 - i, 30]));
      curves.push(
        new 三次曲线("vertical", [
          [0, i],
          [10, i],
          [20, 30 - i],
          [30, 30 - i],
        ]),
      );
    }
    for (let i = 0; i < curves.length; i++) {
      for (let j = 0; j < i; j++) {
        expect(curves[i]!.计算关系(curves[j]!)).toEqual(
          反向关系(curves[j]!.计算关系(curves[i]!)),
        );
      }
    }
  });
});

describe("笔画关系汇总", () => {
  const 多段笔画 = () =>
    [
      new 笔画图形({
        feature: "横折",
        start: [0, 0],
        curveList: [
          { command: "h", parameterList: [30] },
          { command: "v", parameterList: [30] },
        ],
      }),
      new 笔画图形({
        feature: "横折",
        start: [0, 0],
        curveList: [
          { command: "l", parameterList: [40, 10] },
          { command: "h", parameterList: [-40] },
        ],
      }),
    ] as const;

  it("详细关系保留遍历顺序，主要关系选最早的交且排除同向笔画", () => {
    const [a, b] = 多段笔画();
    expect(a.计算关系(b)).toEqual({
      详细关系: [
        { type: "连", first: "前", second: "前" },
        { type: "平行", mainAxis: 0, crossAxis: -1 },
        { type: "交" },
        { type: "交" },
      ],
      交连关系: { type: "交", index1: 1, index2: 0 },
      同向: false,
    });
  });

  it("多个相连关系同级时保留最早的曲线对", () => {
    const [a] = 多段笔画();
    const b = new 笔画图形({
      feature: "横折",
      start: [30, 0],
      curveList: [
        { command: "v", parameterList: [30] },
        { command: "h", parameterList: [-30] },
      ],
    });
    expect(a.计算关系(b).交连关系).toEqual({
      type: "连",
      first: "后",
      second: "前",
      index1: 0,
      index2: 0,
    });
  });

  it("无交连且主轴范围重叠时仍记录同向笔画对", () => {
    const strokes = [0, 20].map(
      (y) =>
        new 笔画图形({
          feature: "横",
          start: [0, y],
          curveList: [{ command: "h", parameterList: [30] }],
        }),
    );
    expect(strokes[0]!.计算关系(strokes[1]!).同向).toBe(true);
    expect(new 拓扑(strokes).同向笔画对).toEqual([[1, 0]]);
  });

  it("构建两套矩阵时，每个方向的曲线对只计算一次且不计算对角项", () => {
    const strokes = 多段笔画();
    const spy = spyOn(曲线.prototype, "计算关系");
    try {
      const topology = new 拓扑([...strokes]);
      expect(spy).toHaveBeenCalledTimes(8);
      expect(topology.关系矩阵[0]![0]).toEqual([]);
      expect(topology.新关系矩阵[0]![0]).toBeUndefined();
      expect(topology.新关系矩阵[0]![1]).toEqual({
        type: "交",
        index1: 1,
        index2: 0,
      });
    } finally {
      spy.mockRestore();
    }
  });
});
