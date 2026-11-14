import { describe, expect, it } from "bun:test";
import { 图形盒子 } from "../src/affine.js";
import type { 矢量图形数据 } from "../src/data.js";
import { 复杂度布局, 方向复杂度 } from "../src/layout.js";
import { 仿射合并 } from "../src/utils.js";

const 竖列 = (xs: number[]): 矢量图形数据 =>
  xs.map((x) => ({
    feature: "竖",
    start: [x, 10],
    curveList: [{ command: "v", parameterList: [80] }],
  }));
const 横列 = (ys: number[]): 矢量图形数据 =>
  ys.map((y) => ({
    feature: "横",
    start: [10, y],
    curveList: [{ command: "h", parameterList: [80] }],
  }));
const box = 图形盒子.从笔画列表构建;

describe("方向复杂度", () => {
  it("区分布局方向，而不是用总笔画数代替", () => {
    expect(方向复杂度(竖列([10, 50, 90]), 0)).toBe(3);
    expect(方向复杂度(竖列([10, 50, 90]), 1)).toBe(1);
    expect(方向复杂度(横列([10, 50, 90]), 1)).toBe(3);
    expect(方向复杂度(横列([10, 50, 90]), 0)).toBe(1);
  });
  it("折线分段与重复路径不会增加密度", () => {
    const split = 竖列([10, 50, 90]).map((s) => ({
      ...s,
      curveList: [
        { command: "v" as const, parameterList: [40] as [number] },
        { command: "v" as const, parameterList: [40] as [number] },
      ],
    }));
    expect(方向复杂度([...split, ...split], 0)).toBe(3);
  });
  it("曲线的平移、非等比缩放及镜像不改变度量", () => {
    const curve: 矢量图形数据 = [
      {
        feature: "撇",
        start: [10, 10],
        curveList: [
          { command: "c", parameterList: [30, 100, 50, -70, 80, 70] },
        ],
      },
    ];
    const transformed: 矢量图形数据 = [
      {
        feature: "撇",
        start: [90, 60],
        curveList: [
          { command: "c", parameterList: [-60, 300, -100, -210, -160, 210] },
        ],
      },
    ];
    for (const axis of [0, 1] as const)
      expect(方向复杂度(transformed, axis)).toBeCloseTo(
        方向复杂度(curve, axis),
        8,
      );
  });
  it("读取三次曲线控制点，不只连接首尾", () => {
    const arch: 矢量图形数据 = [
      {
        feature: "撇",
        start: [10, 10],
        curveList: [{ command: "c", parameterList: [0, 80, 80, 80, 80, 0] }],
      },
    ];
    expect(方向复杂度(arch, 0)).toBe(2);
  });
  it("线段和圆弧、空图形及退化点均返回有限结果", () => {
    expect(
      方向复杂度(
        [
          {
            feature: "点",
            start: [50, 10],
            curveList: [{ command: "a", parameterList: [20] }],
          },
        ],
        0,
      ),
    ).toBe(2);
    expect(
      方向复杂度(
        [
          {
            feature: "撇",
            start: [10, 10],
            curveList: [{ command: "l", parameterList: [80, 80] }],
          },
        ],
        0,
      ),
    ).toBe(1);
    expect(方向复杂度([], 0)).toBe(1);
    expect(
      方向复杂度(
        横列([50]).map((s) => ({
          ...s,
          curveList: [{ command: "h", parameterList: [0] }],
        })),
        1,
      ),
    ).toBe(1);
  });
});

describe("全局复杂度布局", () => {
  it("连续外边框不被误当作需要额外宽度的内部层次", () => {
    const framed = box([...竖列([10, 90]), ...横列([10, 90])]);
    const open = box([...竖列([50]), ...横列([10, 90])]);
    const [a, b] = 复杂度布局([framed, open], 0);
    expect(a!.长度()).toBeLessThanOrEqual(b!.长度());
  });
  it.each([0, 1] as const)("同跨度下，轴 %s 的密集部分得到更多空间", (axis) => {
    const make = axis === 0 ? 竖列 : 横列;
    const sparse = box(make([10, 90])),
      dense = box(make([10, 30, 50, 70, 90]));
    const [a, b] = 复杂度布局([sparse, dense], axis);
    expect(b!.长度()).toBeGreaterThan(a!.长度());
    const reversed = 复杂度布局([dense, sparse], axis);
    expect(reversed[0]!.长度()).toBe(b!.长度());
    expect(reversed[1]!.长度()).toBe(a!.长度());
  });
  it("同密度时保留窄部件的形状信息", () => {
    const [narrow, wide] = 复杂度布局(
      [box(竖列([40, 60])), box(竖列([10, 90]))],
      0,
    );
    expect(narrow!.长度() * 20).toBeLessThan(wide!.长度() * 80);
  });
  it("横竖单线不占主轴面积；全部零跨度也能分开定位", () => {
    const [a, b] = 复杂度布局([box(竖列([50])), box(竖列([50]))], 0);
    expect(a!.长度()).toBe(100);
    expect(b!.长度()).toBe(100);
    expect(a!.起点() + 50).toBe(25);
    expect(b!.起点() + 50).toBe(75);
    expect(复杂度布局([], 0)).toEqual([]);
  });
  it("不改输入，几何一致的不同 ID 得到相同布局，并保留笔顺块", () => {
    const parts = [box(竖列([10, 90])), box(竖列([10, 30, 50, 70, 90]))];
    const before = JSON.stringify(parts.map((p) => p.获取笔画列表()));
    const blocks = [{ index: 1 }, { index: 0 }];
    const a = 仿射合并(parts, [{ id: 1 }, { id: 2 }], "⿰", blocks);
    const b = 仿射合并(parts, [{ id: 909 }, { id: 888 }], "⿰", blocks);
    expect(a.获取笔画列表()).toEqual(b.获取笔画列表());
    expect(a.获取笔画列表()).toHaveLength(7);
    expect(a.获取笔画列表()[0]!.start[0]).toBeGreaterThan(
      a.获取笔画列表()[5]!.start[0],
    );
    expect(JSON.stringify(parts.map((p) => p.获取笔画列表()))).toBe(before);
  });
  it("显式坐标覆盖默认复杂度布局", () => {
    const parts = [box(竖列([10, 90])), box(竖列([10, 30, 50, 70, 90]))];
    const refs = [
      { id: 1, xbegin: 0, xend: 40, ybegin: 0, yend: 100 },
      { id: 2, xbegin: 60, xend: 100, ybegin: 0, yend: 100 },
    ];
    expect(仿射合并(parts, refs, "⿰").获取笔画列表()).toEqual(
      仿射合并(parts, refs, "⿻").获取笔画列表(),
    );
  });
});
