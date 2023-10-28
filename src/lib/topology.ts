import { isEqual } from "underscore";
import {
  CubicCurve,
  Curve,
  Draw,
  Component,
  LinearCurve,
  Point,
  Stroke,
} from "./data";
import { add, subtract, mean, multiply, divide, distance } from "mathjs";

interface RenderedStroke {
  feature: string;
  curveList: Curve[];
}

type RenderedComponent = RenderedStroke[];

type RelationSymbol = -1 | -0.5 | 0 | 0.5 | 1;

interface DisjointRelation {
  x: RelationSymbol;
  y: RelationSymbol;
}

interface AttachRelation {
  first: "前" | "中" | "后";
  second: "前" | "中" | "后";
}

type Relation =
  | {
      type: "交";
    }
  | ({
      type: "连";
    } & AttachRelation)
  | ({
      type: "散";
    } & DisjointRelation);

const getIntervalRelation = (i: [number, number], j: [number, number]) => {
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

const box = (a: Curve) =>
  [a.controls[0], a.controls[a.controls.length - 1]] as [Point, Point];

const getDisjointRelation = function (a: Curve, b: Curve): DisjointRelation {
  const [sa, ea] = box(a);
  const [sb, eb] = box(b);
  return {
    x: getIntervalRelation([sa[0], ea[0]], [sb[0], eb[0]]),
    y: getIntervalRelation([sa[1], ea[1]], [sb[1], eb[1]]),
  };
};

const area = (p: Point, q: Point) => p[0] * q[1] - p[1] * q[0];

const linearRelation = function (a: LinearCurve, b: LinearCurve): Relation {
  const [p, q] = a.controls;
  const [r, s] = b.controls;
  const [v, v1, v2] = [subtract(q, p), subtract(r, p), subtract(s, p)];
  const [vc1, vc2] = [area(v, v1), area(v, v2)];
  const vc = vc1 * vc2;
  const [u, u1, u2] = [subtract(s, r), subtract(p, r), subtract(q, r)];
  const [uc1, uc2] = [area(u, u1), area(u, u2)];
  const uc = uc1 * uc2;
  let attachPosition: AttachRelation;
  if (vc > 0 || uc > 0) {
    return { type: "散", ...getDisjointRelation(a, b) };
  } else if (vc < 0 && uc < 0) {
    return { type: "交" };
  } else if (uc1 === 0) {
    attachPosition = {
      first: "前",
      second: vc1 === 0 ? "前" : vc2 === 0 ? "后" : "中",
    };
  } else if (uc2 === 0) {
    attachPosition = {
      first: "后",
      second: vc1 === 0 ? "前" : vc2 === 0 ? "后" : "中",
    };
  } else if (vc1 === 0) {
    attachPosition = { first: "中", second: "前" };
  } else {
    // (vc2 === 0)
    attachPosition = { first: "中", second: "后" };
  }
  return { type: "连", ...attachPosition };
};

const switchRelation = function (r: Relation): Relation {
  const negate = (x: RelationSymbol) => (0 - x) as RelationSymbol;
  switch (r.type) {
    case "交":
      return r;
    case "散":
      return { ...r, x: negate(r.x), y: negate(r.y) };
    case "连":
      return { ...r, first: r.second, second: r.first };
  }
};

const genericLian = function (a: Curve, b: Curve): Relation | undefined {
  const base = { type: "连" } as const;
  const [astart, aend] = box(a);
  const [bstart, bend] = box(b);
  if (isEqual(astart, bstart)) return { ...base, first: "前", second: "前" };
  if (isEqual(astart, bend)) return { ...base, first: "前", second: "后" };
  if (isEqual(aend, bstart)) return { ...base, first: "后", second: "前" };
  if (isEqual(aend, bend)) return { ...base, first: "后", second: "后" };
};

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

const recurse = function (
  a: Curve,
  at: [number, number],
  b: Curve,
  bt: [number, number],
): Point | undefined {
  const [as, ae] = [evaluate(a, at[0]), evaluate(a, at[1])];
  const [bs, be] = [evaluate(b, bt[0]), evaluate(b, bt[1])];
  const al: LinearCurve = { type: "linear", controls: [as, ae] };
  const bl: LinearCurve = { type: "linear", controls: [bs, be] };
  const disjointRelation = getDisjointRelation(al, bl);
  const totallyDisjoint = [-1, 1];
  if (
    totallyDisjoint.includes(disjointRelation.x) ||
    totallyDisjoint.includes(disjointRelation.y)
  )
    return undefined;
  const [alength, blength] = [distance(as, ae), distance(bs, be)] as [
    number,
    number,
  ];
  const threshold = 1;
  if (alength < threshold && blength < threshold)
    return divide(add(add(as, ae), add(bs, be)), 4) as Point;
  const [atmid, btmid] = [mean(at), mean(bt)];
  const [at1, at2] = [
    [at[0], atmid],
    [atmid, at[1]],
  ] as [[number, number], [number, number]];
  const [bt1, bt2] = [
    [bt[0], btmid],
    [btmid, bt[1]],
  ] as [[number, number], [number, number]];
  return (
    recurse(a, at1, b, bt1) ||
    recurse(a, at1, b, bt2) ||
    recurse(a, at2, b, bt1) ||
    recurse(a, at2, b, bt2)
  );
};

const getRecursiveRelation = function (a: Curve, b: Curve): Relation {
  const crossPoint = recurse(a, [0, 1], b, [0, 1]);
  if (crossPoint === undefined)
    return {
      type: "散" as const,
      ...getDisjointRelation(a, b),
    };
  const lian = { type: "连" } as const;
  const [astart, aend] = box(a);
  const [bstart, bend] = box(b);
  const distanceThreshold = 3;
  if ((distance(crossPoint, astart) as number) < distanceThreshold)
    return { ...lian, first: "前", second: "中" };
  if ((distance(crossPoint, aend) as number) < distanceThreshold)
    return { ...lian, first: "后", second: "中" };
  if ((distance(crossPoint, bstart) as number) < distanceThreshold)
    return { ...lian, first: "中", second: "前" };
  if ((distance(crossPoint, bend) as number) < distanceThreshold)
    return { ...lian, first: "中", second: "后" };
  return { type: "交" };
};

const linearCubicRelation = function (a: LinearCurve, b: CubicCurve): Relation {
  const relation = genericLian(a, b);
  if (relation !== undefined) return relation;
  const [sa, ea] = box(a);
  const [sb, eb] = box(b);
  if (sa[0] === ea[0]) {
    if (sb[0] === sa[0]) return { type: "连", first: "中", second: "前" };
    if (eb[0] === sa[0]) return { type: "连", first: "中", second: "后" };
  } else if (sa[1] === ea[1]) {
    if (sb[1] === sa[1]) return { type: "连", first: "中", second: "前" };
    if (eb[1] === sa[1]) return { type: "连", first: "中", second: "后" };
  }
  return getRecursiveRelation(a, b);
};

const cubicRelation = function (a: CubicCurve, b: CubicCurve): Relation {
  const relation = genericLian(a, b);
  if (relation !== undefined) return relation;
  return getRecursiveRelation(a, b);
};

const curveRelation = (c1: Curve, c2: Curve) => {
  if (c1.type === "linear" && c2.type === "linear") {
    return linearRelation(c1, c2);
  } else if (c1.type === "linear" && c2.type === "cubic") {
    return linearCubicRelation(c1, c2);
  } else if (c1.type === "cubic" && c2.type === "linear") {
    return switchRelation(linearCubicRelation(c2, c1));
  } else {
    return cubicRelation(c1 as CubicCurve, c2 as CubicCurve);
  }
};

const strokeRelation = (s: RenderedStroke, t: RenderedStroke) => {
  const relations = [];
  for (const curve of s.curveList) {
    for (const curve_ of t.curveList) {
      relations.push(curveRelation(curve, curve_));
    }
  }
  return relations;
};

const factory = function (p0: Point, { command, parameterList }: Draw): Curve {
  if (command === "c") {
    const p1 = add(p0, parameterList.slice(0, 2) as Point);
    const p2 = add(p0, parameterList.slice(2, 4) as Point);
    const p3 = add(p0, parameterList.slice(4) as Point);
    return { type: "cubic", controls: [p0, p1, p2, p3] };
  }
  let p1: Point;
  switch (command) {
    case "h":
      p1 = add(p0, [parameterList[0], 0]);
      break;
    case "v":
      p1 = add(p0, [0, parameterList[0]]);
      break;
    case "l":
      p1 = add(p0, parameterList);
      break;
  }
  return { type: "linear", controls: [p0, p1] };
};

const render = ({ feature, start, curveList }: Stroke) => {
  const r: RenderedStroke = { feature, curveList: [] };
  let previousPosition = start;
  for (const draw of curveList) {
    const curve = factory(previousPosition, draw);
    previousPosition = curve.controls[curve.controls.length - 1];
    r.curveList.push(curve);
  }
  return r;
};

const findTopology = (glyph: Component) => {
  const g = glyph.map(render);
  const matrix = [] as Relation[][][];
  for (const [i, s] of g.entries()) {
    const row = [] as Relation[][];
    for (const [j, t] of g.entries()) {
      if (j >= i) break;
      row.push(strokeRelation(s, t));
    }
    matrix.push(row);
  }
  return matrix;
};

export default findTopology;
export {
  area,
  factory,
  getDisjointRelation as disjointPosition,
  getIntervalRelation as intervalPosition,
  render,
};
export {
  curveRelation,
  linearRelation,
  linearCubicRelation,
  cubicRelation,
  strokeRelation,
};
export type { Relation };
