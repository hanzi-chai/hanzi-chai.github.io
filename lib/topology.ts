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
import { add as vadd, cross as vcross, subtract as vsub, mean } from "mathjs";

interface DisjointPosition {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

const negate = (x: -1 | 0 | 1) => -x as -1 | 0 | 1;

interface AttachPosition {
  first: "前" | "中" | "后";
  second: "前" | "中" | "后";
}

type Relation =
  | {
      type: "交";
    }
  | {
      type: "连";
      position: AttachPosition;
    }
  | {
      type: "散";
      position: DisjointPosition;
    };

const add = function (p: Point, q: Point): Point {
  return vadd(p, q);
};

const sub = function (p: Point, q: Point): Point {
  return vsub(p, q);
};

const cross = function (p: Point, q: Point): number {
  const vector = vcross(p.concat(0), q.concat(0)) as number[];
  return vector[2];
};

const factory = function (
  p0: Point,
  { command, parameterList }: Draw,
): [Curve, Point] {
  let p1, p2, p3;
  if (command === "c") {
    p1 = add(p0, parameterList.slice(0, 2) as Point);
    p2 = add(p0, parameterList.slice(2, 4) as Point);
    p3 = add(p0, parameterList.slice(4) as Point);
    return [{ type: "cubic", controls: [p0, p1, p2, p3] }, p3];
  }
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
  return [{ type: "linear", controls: [p0, p1] }, p1];
};

const render = ({ feature, start, curveList }: Stroke) => {
  const r: RenderedStroke = { feature, curveList: [] };
  let previousPosition = start;
  for (const draw of curveList) {
    const [curve, currentPosition] = factory(previousPosition, draw);
    r.curveList.push(curve);
    previousPosition = currentPosition;
  }
  return r;
};

const intervalPosition = (i: [number, number], j: [number, number]) => {
  const [imin, imax] = i.sort();
  const [jmin, jmax] = j.sort();
  const [imid, jmid] = [mean(i), mean(j)];
  if (imin > jmid && jmax < imid) return -1;
  if (jmin > imid && imax < jmid) return 1;
  return 0;
};

const position = function (a: Curve, b: Curve): DisjointPosition {
  const [sa, ea] = [a.controls[0], a.controls[a.controls.length - 1]];
  const [sb, eb] = [b.controls[0], b.controls[b.controls.length - 1]];
  return {
    x: intervalPosition([sa[0], ea[0]], [sb[0], eb[0]]),
    y: intervalPosition([sa[1], ea[1]], [sb[1], eb[1]]),
  };
};

const linearRelation = function (a: LinearCurve, b: LinearCurve): Relation {
  const [p, q] = a.controls;
  const [r, s] = b.controls;
  const [v, v1, v2] = [vsub(q, p), vsub(r, p), vsub(s, p)];
  const [vc1, vc2] = [cross(v, v1), cross(v, v2)];
  const vc = vc1 * vc2;
  const [u, u1, u2] = [vsub(s, r), vsub(p, r), vsub(q, r)];
  const [uc1, uc2] = [cross(u, u1), cross(u, u2)];
  const uc = uc1 * uc2;
  if (vc > 0 || uc > 0) {
    return { type: "散", position: position(a, b) };
  } else if (vc < 0 && uc < 0) {
    return { type: "交" };
  } else {
    let p: AttachPosition;
    if (vc1 === 0) {
      p = { first: "前", second: uc1 === 0 ? "前" : uc2 === 0 ? "后" : "中" };
    } else if (vc2 === 0) {
      p = { first: "后", second: uc1 === 0 ? "前" : uc2 === 0 ? "后" : "中" };
    } else if (uc1 === 0) {
      p = { first: "中", second: "前" };
    } else if (uc2 === 0) {
      p = { first: "中", second: "后" };
    } else {
      p = { first: "中", second: "中" }; // never
    }
    return { type: "连", position: p };
  }
};

const switchRelation = function (r: Relation): Relation {
  switch (r.type) {
    case "交":
      return r;
    case "散":
      const { position } = r;
      return {
        type: r.type,
        position: { x: negate(position.x), y: negate(position.y) },
      };
    case "连":
      const {
        position: { first, second },
      } = r;
      return { type: r.type, position: { first: second, second: first } };
  }
};

const linearize = function ({ type, controls }: CubicCurve): LinearCurve {
  return { type: "linear", controls: [controls[0], controls[3]] };
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
export { cross, render, linearRelation, position, intervalPosition };
export type { Relation };
