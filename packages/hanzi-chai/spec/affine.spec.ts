import type { 复合体数据, 矢量图形数据 } from "../src/main.js";
import { 图形盒子 } from "../src/main.js";
import { describe, expect, it } from "vitest";

describe("仿射变换", () => {
  it("合并部件", () => {
    const 复合体: 复合体数据 = {
      type: "compound",
      operator: "⿰",
      operandList: ["甲", "乙"],
    };
    const 甲 = 图形盒子.从笔画列表构建([
      {
        feature: "横",
        start: [20, 50],
        curveList: [{ command: "h", parameterList: [60] }],
      },
    ]);
    const 乙 = 图形盒子.从笔画列表构建([
      {
        feature: "竖",
        start: [50, 10],
        curveList: [{ command: "v", parameterList: [80] }],
      },
    ]);
    const 合并后: 矢量图形数据 = [
      {
        feature: "横",
        start: [20, 50],
        curveList: [{ command: "h", parameterList: [60] }],
      },
      {
        feature: "竖",
        start: [100, 10],
        curveList: [{ command: "v", parameterList: [80] }],
      },
    ];

    expect(图形盒子.仿射合并(复合体, [甲, 乙]).获取笔画列表()).toEqual(合并后);
  });

  it("合并带有笔顺信息的部件", () => {
    const 复合体: 复合体数据 = {
      type: "compound",
      operator: "⿴",
      operandList: ["甲", "乙"],
      order: [
        { index: 1, strokes: 1 },
        { index: 0, strokes: 0 },
      ],
    };
    const 甲 = 图形盒子.从笔画列表构建([
      {
        feature: "撇",
        start: [50, 10],
        curveList: [{ command: "c", parameterList: [0, -20, 0, -40, 10, -60] }],
      },
    ]);
    const 乙 = 图形盒子.从笔画列表构建([
      {
        feature: "平点",
        start: [50, 10],
        curveList: [{ command: "z", parameterList: [20, 0, 30, 0, 40, 10] }],
      },
    ]);
    const 合并后: 矢量图形数据 = [
      {
        feature: "平点",
        start: [50, 30],
        curveList: [{ command: "z", parameterList: [10, 0, 15, 0, 20, 5] }],
      },
      ...甲.获取笔画列表(),
    ];

    expect(图形盒子.仿射合并(复合体, [甲, 乙]).获取笔画列表()).toEqual(合并后);
  });
});
