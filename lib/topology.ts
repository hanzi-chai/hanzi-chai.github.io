import {
  CubicCurve,
  Curve,
  Draw,
  Glyph,
  LinearCurve,
  Point,
  RenderedGlyph,
  RenderedStroke,
  Stroke,
} from "./data";
import { add, subtract, mean } from "mathjs";

interface DisjointPosition {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

interface AttachPosition {
  first: "前" | "中" | "后";
  second: "前" | "中" | "后";
}

type Relation =
  | {
      type: "交";
    }
  | ({
      type: "连";
    } & AttachPosition)
  | ({
      type: "散";
    } & DisjointPosition);

const intervalPosition = (i: [number, number], j: [number, number]) => {
  const [imin, imax] = i.sort();
  const [jmin, jmax] = j.sort();
  const [imid, jmid] = [mean(i), mean(j)];
  if (imid <= jmin && imax <= jmid) return -1;
  if (imin >= jmid && imid >= jmax) return 1;
  return 0;
};

const box = (a: Curve) =>
  [a.controls[0], a.controls[a.controls.length - 1]] as [Point, Point];

const disjointPosition = function (a: Curve, b: Curve): DisjointPosition {
  const [sa, ea] = box(a);
  const [sb, eb] = box(b);
  return {
    x: intervalPosition([sa[0], ea[0]], [sb[0], eb[0]]),
    y: intervalPosition([sa[1], ea[1]], [sb[1], eb[1]]),
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
  let attachPosition: AttachPosition;
  if (vc > 0 || uc > 0) {
    return { type: "散", ...disjointPosition(a, b) };
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
  const negate = (x: -1 | 0 | 1) => (0 - x) as -1 | 0 | 1;
  switch (r.type) {
    case "交":
      return r;
    case "散":
      return { ...r, x: negate(r.x), y: negate(r.y) };
    case "连":
      return { ...r, first: r.second, second: r.first };
  }
};

const linearize = function (a: CubicCurve): LinearCurve {
  return { type: "linear", controls: box(a) };
};

const linearCubicRelation = function (a: LinearCurve, b: CubicCurve): Relation {
  // 未实现，先使用线性化代替
  return linearRelation(a, linearize(b));
};

const cubicRelation = function (a: CubicCurve, b: CubicCurve): Relation {
  // 未实现，先使用线性化代替
  return linearRelation(linearize(a), linearize(b));
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

const findTopology = (glyph: Glyph) => {
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
export { area, factory, disjointPosition, intervalPosition, render };
export {
  curveRelation,
  linearRelation,
  linearCubicRelation,
  cubicRelation,
  strokeRelation,
};
export type { Relation };
