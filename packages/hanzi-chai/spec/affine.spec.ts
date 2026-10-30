import type { 矢量图形数据 } from "../src/data.js";
import { 仿射合并 } from "../src/utils.js";
import { 图形盒子 } from "../src/affine.js";
import { describe, expect, it } from "bun:test";
import { 复合体数据 } from "../src/data.js";

describe("仿射变换", () => {
  it("合并部件", () => {
    const 复合体: 复合体数据 = {
      id: 1,
      type: "compound",
      operator: "⿰",
      references: [{ id: 1 }, { id: 2 }],
      ambiguous: false,
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
        start: [10, 50],
        curveList: [{ command: "h", parameterList: [60] }],
      },
      {
        feature: "竖",
        start: [90, 10],
        curveList: [{ command: "v", parameterList: [80] }],
      },
    ];

    expect(
      仿射合并(
        [甲, 乙],
        复合体.references,
        复合体.operator,
        复合体.strokes,
      ).获取笔画列表(),
    ).toEqual(合并后);
  });

  it("合并带有笔顺信息的部件", () => {
    const 复合体: 复合体数据 = {
      id: 2,
      type: "compound",
      operator: "⿴",
      references: [{ id: 1 }, { id: 2 }],
      ambiguous: false,
      strokes: [{ index: 1 }, { index: 0 }],
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

    expect(
      仿射合并(
        [甲, 乙],
        复合体.references,
        复合体.operator,
        复合体.strokes,
      ).获取笔画列表(),
    ).toEqual(合并后);
  });

  it.each([
    "⿰",
    "⿱",
  ] as const)("相同笔画以基本部件或复合体参与 %s 布局时结果一致", (operator) => {
    const 横: 矢量图形数据 = [
      {
        feature: "横",
        start: [20, 50],
        curveList: [{ command: "h", parameterList: [60] }],
      },
    ];
    const 竖: 矢量图形数据 = [
      {
        feature: "竖",
        start: [50, 30],
        curveList: [{ command: "v", parameterList: [40] }],
      },
    ];
    const 基本部件 = 图形盒子.从笔画列表构建([...横, ...竖]);
    const 复合体 = 仿射合并(
      [图形盒子.从笔画列表构建(横), 图形盒子.从笔画列表构建(竖)],
      [{ id: 1 }, { id: 2 }],
      "⿻",
    );
    expect(复合体.获取笔画列表()).toEqual(基本部件.获取笔画列表());
    expect(复合体.横向区间.toArray()).toEqual([20, 80]);
    expect(复合体.纵向区间.toArray()).toEqual([30, 70]);

    const 合并 = (部分: 图形盒子) =>
      仿射合并([部分, 基本部件], [{ id: 3 }, { id: 4 }], operator);
    expect(合并(复合体).获取笔画列表()).toEqual(合并(基本部件).获取笔画列表());
  });

  it("包围盒仅包含变换并按笔画块选取后的笔画", () => {
    const 横 = 图形盒子.从笔画列表构建([
      {
        feature: "横",
        start: [20, 50],
        curveList: [{ command: "h", parameterList: [60] }],
      },
    ]);
    const 合并后 = 仿射合并(
      [横, 横],
      [{ id: 1, xbegin: 10, xend: 90, ybegin: 20, yend: 80 }, { id: 2 }],
      "⿻",
      [{ index: 0 }],
    );
    expect(合并后.横向区间.toArray()).toEqual([26, 74]);
    expect(合并后.纵向区间.toArray()).toEqual([50, 50]);
  });

  it("空图形保留有限的默认包围盒", () => {
    const 合并后 = 仿射合并([], []);
    expect(合并后.获取笔画列表()).toEqual([]);
    expect(合并后.横向区间.toArray()).toEqual([0, 100]);
    expect(合并后.纵向区间.toArray()).toEqual([0, 100]);
  });
});
