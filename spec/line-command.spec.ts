import { describe, expect, it } from "bun:test";
import { 仿射变换 } from "../src/affine";
import { 创建曲线, 区间, 笔画图形 } from "../src/bezier";
import { 模拟矢量笔画 } from "../src/utils";

describe("提的相对直线命令", () => {
  it("按两个坐标分量构造直线并从实际终点接续下一段", () => {
    const stroke = new 笔画图形({ feature: "横折提", start: [30, 95], curveList: [
      { command: "l", parameterList: [40, -6] },
      { command: "v", parameterList: [10] },
    ] });
    expect(stroke.curveList[0]!.获取起点和终点()).toEqual([[30, 95], [70, 89]]);
    expect(stroke.curveList[1]!.获取起点和终点()).toEqual([[70, 89], [70, 99]]);
  });
  it("斜直线的交叉与端点连接可被拓扑识别", () => {
    const ti = 创建曲线([10, 30], { command: "l", parameterList: [40, -20] });
    const crossing = 创建曲线([30, 0], { command: "v", parameterList: [40] });
    const touching = 创建曲线([50, 10], { command: "v", parameterList: [20] });
    expect(ti.计算关系(crossing)).toEqual({ type: "交" });
    expect(ti.计算关系(touching)).toEqual({ type: "连", first: "后", second: "前" });
  });
  it("非等比变换同时缩放提的横向与纵向分量", () => {
    const transformed = new 仿射变换(new 区间(0, 50), new 区间(0, 100)).变换笔画({
      feature: "提", start: [20, 70], curveList: [{ command: "l", parameterList: [40, -20] }],
    });
    expect(transformed.start).toEqual([10, 70]);
    expect(transformed.curveList).toEqual([{ command: "l", parameterList: [20, -20] }]);
  });
  it("编辑旧提时保留原长度，已保存的直线参数不丢失", () => {
    expect(模拟矢量笔画("提", [30,95], [{command:"h",parameterList:[40]}]).curveList).toEqual([{command:"l",parameterList:[40,-6]}]);
    expect(模拟矢量笔画("竖提", [20,20], [{command:"v",parameterList:[50]},{command:"l",parameterList:[30,-25]}]).curveList).toEqual([{command:"v",parameterList:[50]},{command:"l",parameterList:[30,-25]}]);
    expect(模拟矢量笔画("横折提").curveList.map(c=>c.command)).toEqual(["h","v","l"]);
  });
});
