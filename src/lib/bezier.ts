import type { Draw, Point, SVGStroke } from "./data";
import {
  add,
  subtract,
  mean,
  multiply,
  divide,
  distance as _distance,
  dot,
} from "mathjs";

interface LinearCurve {
  type: "linear";
  controls: [Point, Point];
}

interface CubicCurve {
  type: "cubic";
  controls: [Point, Point, Point, Point];
}

type Curve = LinearCurve | CubicCurve;

interface RenderedStroke {
  feature: string;
  curveList: Curve[];
}

const getBoundingBox = (a: Curve) =>
  [a.controls[0], a.controls[a.controls.length - 1]] as [Point, Point];

const evaluate = function (a: Curve, t: number): Point {
  if (a.type === "linear") {
    return add(
      multiply(1 - t, a.controls[0]) as Point,
      multiply(t, a.controls[1]) as Point,
    );
  } else {
    const v01 = add(
      multiply(Math.pow(1 - t, 3), a.controls[0]),
      multiply(3 * Math.pow(1 - t, 2) * t, a.controls[1]),
    );
    const v23 = add(
      multiply(3 * (1 - t) * Math.pow(t, 2), a.controls[2]),
      multiply(Math.pow(t, 3), a.controls[3]),
    );
    return add(v01, v23) as Point;
  }
};

const makeCurve = function (
  start: Point,
  { command, parameterList }: Draw,
): Curve {
  if (command === "c" || command === "z") {
    const p1 = add(start, parameterList.slice(0, 2) as Point);
    const p2 = add(start, parameterList.slice(2, 4) as Point);
    const p3 = add(start, parameterList.slice(4) as Point);
    return { type: "cubic", controls: [start, p1, p2, p3] };
  }
  let p1: Point;
  switch (command) {
    case "h":
      p1 = add(start, [parameterList[0], 0]);
      break;
    case "v":
      p1 = add(start, [0, parameterList[0]]);
      break;
  }
  return { type: "linear", controls: [start, p1] };
};

const render = ({ feature, start, curveList }: SVGStroke) => {
  const r: RenderedStroke = { feature, curveList: [] };
  let previousPosition = start;
  for (const draw of curveList) {
    const curve = makeCurve(previousPosition, draw);
    previousPosition =
      curve.type === "linear" ? curve.controls[1] : curve.controls[3];
    r.curveList.push(curve);
  }
  return r;
};

const area = (p: Point, q: Point) => p[0] * q[1] - p[1] * q[0];
const distance = (p: Point, q: Point) => _distance(p, q) as number;

type Interval = [number, number];

type Position = -1 | -0.5 | 0 | 0.5 | 1;

const getIntervalPosition = function (i: Interval, j: Interval): Position {
  const [imin, imax] = i.sort((a, b) => a - b);
  const [jmin, jmax] = j.sort((a, b) => a - b);
  // totally disjoint
  if (imax < jmin) return -1;
  if (imin > jmax) return 1;
  // generally smaller or larger
  if (imin < jmin && imax < jmax) return -0.5;
  if (imin > jmin && imax > jmax) return +0.5;
  return 0;
};

const findCrossPoint = function (
  a: Curve,
  at: Interval,
  b: Curve,
  bt: Interval,
): Point | undefined {
  const [astart, aend] = [evaluate(a, at[0]), evaluate(a, at[1])];
  const [bstart, bend] = [evaluate(b, bt[0]), evaluate(b, bt[1])];
  const xposition = getIntervalPosition(
    [astart[0], aend[0]],
    [bstart[0], bend[0]],
  );
  const yposition = getIntervalPosition(
    [astart[1], aend[1]],
    [bstart[1], bend[1]],
  );
  const totallyDisjoint = [-1, 1];
  if (
    totallyDisjoint.includes(xposition) ||
    totallyDisjoint.includes(yposition)
  )
    return undefined;
  const [alength, blength] = [distance(astart, aend), distance(bstart, bend)];
  const threshold = 1;
  if (alength < threshold && blength < threshold)
    return divide(add(add(astart, aend), add(bstart, bend)), 4) as Point;
  const [atmid, btmid] = [mean(at), mean(bt)];
  const a_firsthalf = [at[0], atmid] as Interval;
  const a_secondhalf = [atmid, at[1]] as Interval;
  const b_firsthalf = [bt[0], btmid] as Interval;
  const b_secondhalf = [btmid, bt[1]] as Interval;
  return (
    findCrossPoint(a, a_firsthalf, b, b_firsthalf) ||
    findCrossPoint(a, a_firsthalf, b, b_secondhalf) ||
    findCrossPoint(a, a_secondhalf, b, b_firsthalf) ||
    findCrossPoint(a, a_secondhalf, b, b_secondhalf)
  );
};

/**
 * Determine if the point is on a given segment
 * @param from - starting point
 * @param to - end point
 * @param point - another point
 * @returns
 */
const isCollinear = (from: Point, to: Point, point: Point) => {
  const [u, v] = [subtract(to, point), subtract(from, point)];
  return area(u, v) === 0 && dot(u, v) < 0;
};

const curveLength = (curve: Curve) => {
  const [start, end] = getBoundingBox(curve);
  return distance(start, end);
};

const sort = function (a: Interval): Interval {
  return a.sort((a, b) => a - b);
};

const contains = (r1: Interval, r2: Interval) => {
  return r1[0] <= r2[0] && r1[1] >= r2[1];
};

const _isBoundedBy = (curve: Curve, xrange: Interval, yrange: Interval) => {
  const [start, end] = getBoundingBox(curve);
  const thisXRange = sort([start[0], end[0]]);
  const thisYRange = sort([start[1], end[1]]);
  return contains(xrange, thisXRange) && contains(yrange, thisYRange);
};

const isBoundedBy = (
  stroke: RenderedStroke,
  xrange: Interval,
  yrange: Interval,
) => {
  return stroke.curveList.every((x) => _isBoundedBy(x, xrange, yrange));
};

export {
  getBoundingBox,
  getIntervalPosition,
  evaluate,
  render,
  makeCurve,
  area,
  distance,
  curveLength,
  findCrossPoint,
  isCollinear,
  isBoundedBy,
};
export type { LinearCurve, CubicCurve, Curve, RenderedStroke };
export type { Interval, Position };
