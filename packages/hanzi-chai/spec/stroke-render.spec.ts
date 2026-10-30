import { describe, expect, it } from "bun:test";
import { 笔画表示方式 } from "../src/classifier.js";
import type { 向量, 矢量笔画数据 } from "../src/data.js";
import { 生成笔画路径, 处理路径 } from "../src/stroke-render.js";
import { 模拟矢量笔画 } from "../src/utils.js";

const vertical = (length: number): 矢量笔画数据 => ({
  feature: "竖钩",
  start: [50, 10],
  curveList: [{ command: "v", parameterList: [length] }],
});
const bend = (dx = 60, dy = 60): 矢量笔画数据 => ({
  feature: "竖弯",
  start: [20, 20],
  curveList: [
    { command: "v", parameterList: [dy] },
    { command: "h", parameterList: [dx] },
  ],
});
const parse = (path: string) =>
  [...path.matchAll(/([MLC])([^MLC]*)/g)].map((m) => ({
    command: m[1]!,
    points: m[2]!.trim().split(/\s+/).map(Number),
  }));
const tip = (path: string): 向量 =>
  parse(path).at(-1)!.points.slice(-2) as 向量;
const norm = (a: 向量, b: 向量) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const render = (s: 矢量笔画数据) => 生成笔画路径([s])[0]!;

describe("显示用钩和圆角", () => {
  it("全部钩类都生成收笔，包括卧钩和横斜弯钩", () => {
    for (const feature of Object.keys(笔画表示方式).filter((x) =>
      x.endsWith("钩"),
    )) {
      const stroke = 模拟矢量笔画(feature as 矢量笔画数据["feature"]);
      const path = parse(render(stroke));
      expect(path.at(-1)!.command).toBe("C");
      expect(path.length).toBeGreaterThan(stroke.curveList.length + 1);
    }
  });
  it("小尺寸钩按末段长度缩小，没有固定的最小钩长", () => {
    const a = tip(render(vertical(20))),
      b = tip(render(vertical(6)));
    expect(norm(b, [50, 16]) / norm(a, [50, 30])).toBeCloseTo(0.3, 5);
    expect(norm(tip(render(vertical(0))), [50, 10])).toBe(0);
  });
  it("竖钩向左上收笔，邻近笔画限制伸出距离", () => {
    const stroke = vertical(60),
      obstacle: 矢量笔画数据 = {
        feature: "竖",
        start: [46, 50],
        curveList: [{ command: "v", parameterList: [30] }],
      };
    const free = tip(render(stroke)),
      constrained = tip(生成笔画路径([stroke, obstacle])[0]!);
    expect(free[0]).toBeLessThan(50);
    expect(free[1]).toBeLessThan(70);
    expect(constrained[0]).toBeGreaterThan(46);
    expect(norm(constrained, [50, 70])).toBeLessThan(norm(free, [50, 70]));
  });
  it("贝塞尔末端与钩保持切线连续，不把曲线替换成竖线", () => {
    const s: 矢量笔画数据 = {
      feature: "弯钩",
      start: [20, 10],
      curveList: [{ command: "c", parameterList: [30, 20, 40, 45, 25, 70] }],
    };
    const p = parse(render(s));
    expect(p.map((x) => x.command)).toEqual(["M", "C", "C"]);
    const a = p[1]!.points,
      b = p[2]!.points;
    const u = [a[4]! - a[2]!, a[5]! - a[3]!],
      v = [b[0]! - a[4]!, b[1]! - a[5]!];
    expect(Math.abs(u[0]! * v[1]! - u[1]! * v[0]!)).toBeLessThan(1e-4);
    expect(u[0]! * v[0]! + u[1]! * v[1]!).toBeGreaterThan(0);
  });
  it("同起点竖点的顶盖关系按几何识别，不依赖部件 ID", () => {
    const point: 矢量笔画数据 = {
      feature: "点",
      start: [20, 20],
      curveList: [{ command: "c", parameterList: [0, 3, 0, 7, 0, 10] }],
    };
    const horizontal: 矢量笔画数据 = {
      feature: "横钩",
      start: [20, 20],
      curveList: [{ command: "h", parameterList: [60] }],
    };
    expect(tip(生成笔画路径([point, horizontal])[1]!)[0]).toBe(80);
    expect(tip(render(horizontal))[0]).toBeLessThan(80);
  });
  it("反向线段也正确圆角，非钩笔画的末端不漂移", () => {
    for (const dx of [-60, 60])
      for (const dy of [-60, 60]) {
        const s = bend(dx, dy),
          p = parse(render(s));
        expect(p.map((x) => x.command)).toEqual(["M", "L", "C", "L"]);
        expect(tip(render(s))).toEqual([20 + dx, 20 + dy]);
        const controls = p[2]!.points;
        for (let i = 0; i < controls.length; i += 2) {
          expect(controls[i]).toBeGreaterThanOrEqual(Math.min(20, 20 + dx));
          expect(controls[i]).toBeLessThanOrEqual(Math.max(20, 20 + dx));
          expect(controls[i + 1]).toBeGreaterThanOrEqual(Math.min(20, 20 + dy));
          expect(controls[i + 1]).toBeLessThanOrEqual(Math.max(20, 20 + dy));
        }
      }
  });
  it("短末段同时容纳弯和钩时不会被两次裁剪成反向线段", () => {
    const s = { ...bend(2, 60), feature: "竖弯钩" as const };
    const p = parse(render(s)),
      join = p[2]!.points,
      body = p[3]!.points;
    expect(body[0]).toBeGreaterThan(join[4]!);
    expect(body[0]).toBeLessThanOrEqual(22);
  });
  it("有其他笔画连接的转角不裁掉；折保持折角", () => {
    const s = bend(),
      other: 矢量笔画数据 = {
        feature: "横",
        start: [10, 80],
        curveList: [{ command: "h", parameterList: [10] }],
      };
    expect(parse(生成笔画路径([s, other])[0]!).map((x) => x.command)).toEqual([
      "M",
      "L",
      "L",
    ]);
    expect(
      parse(render({ ...s, feature: "竖折" })).map((x) => x.command),
    ).toEqual(["M", "L", "L"]);
  });
  it("带钩的收笔点有连接时保留骨架端点", () => {
    const s = vertical(60),
      other: 矢量笔画数据 = {
        feature: "横",
        start: [50, 70],
        curveList: [{ command: "h", parameterList: [10] }],
      };
    const p = parse(生成笔画路径([s, other])[0]!);
    expect(p[1]!.points).toEqual([50, 70]);
  });
  it("保护靠近转角的连接点，并避开圆角新经过的邻笔", () => {
    const s = bend();
    const attached: 矢量笔画数据 = {
      feature: "横",
      start: [10, 77],
      curveList: [{ command: "h", parameterList: [10] }],
    };
    const inside: 矢量笔画数据 = {
      feature: "竖",
      start: [22, 70],
      curveList: [{ command: "v", parameterList: [9] }],
    };
    for (const neighbor of [attached, inside])
      expect(
        parse(生成笔画路径([s, neighbor])[0]!).map((x) => x.command),
      ).toEqual(["M", "L", "L"]);
    const hookNeighbor: 矢量笔画数据 = {
      feature: "横",
      start: [50, 69],
      curveList: [{ command: "h", parameterList: [10] }],
    };
    expect(
      parse(生成笔画路径([vertical(60), hookNeighbor])[0]!)[1]!.points,
    ).toEqual([50, 70]);
  });
  it("已经平滑相接的曲线不再重做圆角", () => {
    const s: 矢量笔画数据 = {
      feature: "竖弯",
      start: [20, 20],
      curveList: [
        { command: "c", parameterList: [0, 50, 0, 60, 20, 60] },
        { command: "h", parameterList: [40] },
      ],
    };
    expect(parse(render(s)).map((x) => x.command)).toEqual(["M", "C", "L"]);
    expect(tip(render(s))).toEqual([80, 80]);
  });
  it("空、零长度和控制点退化的曲线生成有限路径", () => {
    const cases: 矢量笔画数据[] = [
      { feature: "竖弯钩", start: [5, 5], curveList: [] },
      vertical(0),
      {
        feature: "卧钩",
        start: [0, 0],
        curveList: [{ command: "c", parameterList: [0, 0, 20, 0, 20, 0] }],
      },
      bend(0, 10),
    ];
    for (const s of cases) expect(render(s)).not.toMatch(/NaN|Infinity/);
  });
  it("不修改输入数据，批量接口与兼容回调一致", () => {
    const strokes = [vertical(60), bend()];
    const before = structuredClone(strokes);
    const paths = 生成笔画路径(strokes);
    expect(paths).toEqual(strokes.map(处理路径));
    expect(strokes).toEqual(before);
  });
  it("普通曲线与显式提的坐标不变，旧 h 提兼容显示", () => {
    const normal: 矢量笔画数据 = {
      feature: "撇",
      start: [60, 10],
      curveList: [{ command: "c", parameterList: [-5, 10, -15, 20, -40, 60] }],
    };
    expect(parse(render(normal))[1]!.points).toEqual([55, 20, 45, 30, 20, 70]);
    expect(
      tip(
        render({
          feature: "提",
          start: [10, 60],
          curveList: [{ command: "l", parameterList: [40, -20] }],
        }),
      ),
    ).toEqual([50, 40]);
    expect(
      tip(
        render({
          feature: "提",
          start: [10, 60],
          curveList: [{ command: "h", parameterList: [40] }],
        }),
      ),
    ).toEqual([50, 54]);
  });
});
