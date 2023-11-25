import { isEqual } from "~/lib/utils";
import type { SVGGlyph, SVGStroke } from "./data";
import { subtract } from "mathjs";
import type { Curve, LinearCurve, Position } from "./bezier";
import {
  area,
  distance,
  findCrossPoint,
  getBoundingBox,
  getIntervalOnOrientation,
  getIntervalPosition,
  isCollinear,
  makeCurve,
} from "./bezier";

interface RenderedStroke extends Pick<SVGStroke, "feature"> {
  curveList: Curve[];
}

type RenderedGlyph = RenderedStroke[];

interface CrossRelation {
  type: "交";
}

interface AttachRelation {
  type: "连";
  first: "前" | "中" | "后";
  second: "前" | "中" | "后";
}

const makeAttachRelation = function (
  first: AttachRelation["first"],
  second: AttachRelation["second"],
): AttachRelation {
  return { type: "连", first, second };
};

interface ParallelRelation {
  type: "平行";
  mainAxis: Position;
  crossAxis: Position;
}

interface PerpendicularRelation {
  type: "散";
  x: Position;
  y: Position;
}

type DisjointRelation = ParallelRelation | PerpendicularRelation;
type CurveRelation = CrossRelation | AttachRelation | DisjointRelation;

const getParallelRelation = function (a: Curve, b: Curve): ParallelRelation {
  const [amain, across] = getIntervalOnOrientation(a);
  const [bmain, bcross] = getIntervalOnOrientation(b);
  const mainPosition = getIntervalPosition(amain, bmain);
  const crossPosition = getIntervalPosition(across, bcross);
  return { type: "平行", mainAxis: mainPosition, crossAxis: crossPosition };
};

const getDisjointRelation = function (a: Curve, b: Curve): DisjointRelation {
  if (a.orientation === b.orientation) return getParallelRelation(a, b);
  const [astart, aend] = getBoundingBox(a);
  const [bstart, bend] = getBoundingBox(b);
  return {
    type: "散",
    x: getIntervalPosition([astart[0], aend[0]], [bstart[0], bend[0]]),
    y: getIntervalPosition([astart[1], aend[1]], [bstart[1], bend[1]]),
  };
};

const getAttachRelation = function (
  a: Curve,
  b: Curve,
): AttachRelation | undefined {
  const [astart, aend] = getBoundingBox(a);
  const [bstart, bend] = getBoundingBox(b);
  if (isEqual(astart, bstart)) return makeAttachRelation("前", "前");
  if (isEqual(astart, bend)) return makeAttachRelation("前", "后");
  if (isEqual(aend, bstart)) return makeAttachRelation("后", "前");
  if (isEqual(aend, bend)) return makeAttachRelation("后", "后");
  if (a.type === "linear") {
    if (isCollinear(astart, aend, bstart))
      return makeAttachRelation("中", "前");
    if (isCollinear(astart, aend, bend)) return makeAttachRelation("中", "后");
  }
  if (b.type === "linear") {
    if (isCollinear(bstart, bend, astart))
      return makeAttachRelation("前", "中");
    if (isCollinear(bstart, bend, aend)) return makeAttachRelation("后", "中");
  }
};

const linearRelation = function (
  a: LinearCurve,
  b: LinearCurve,
): CurveRelation {
  const [astart, aend] = a.controls;
  const [bstart, bend] = b.controls;
  const [v, v1, v2] = [
    subtract(aend, astart),
    subtract(bstart, astart),
    subtract(bend, astart),
  ];
  const vc = area(v, v1) * area(v, v2);
  const [u, u1, u2] = [
    subtract(bend, bstart),
    subtract(astart, bstart),
    subtract(aend, bstart),
  ];
  const uc = area(u, u1) * area(u, u2);
  if (vc > 0 || uc > 0) {
    return getDisjointRelation(a, b);
  }
  return { type: "交" };
};

const genericRelation = function (a: Curve, b: Curve): CurveRelation {
  const crossPoint = findCrossPoint(a, [0, 1], b, [0, 1]);
  if (crossPoint === undefined) return getDisjointRelation(a, b);
  const [astart, aend] = getBoundingBox(a);
  const [bstart, bend] = getBoundingBox(b);
  const distanceThreshold = 3;
  if (distance(crossPoint, astart) < distanceThreshold)
    return makeAttachRelation("前", "中");
  if (distance(crossPoint, aend) < distanceThreshold)
    return makeAttachRelation("后", "中");
  if (distance(crossPoint, bstart) < distanceThreshold)
    return makeAttachRelation("中", "前");
  if (distance(crossPoint, bend) < distanceThreshold)
    return makeAttachRelation("中", "后");
  return { type: "交" };
};

const curveRelation = (c1: Curve, c2: Curve) => {
  const relation = getAttachRelation(c1, c2);
  if (relation !== undefined) return relation;
  if (c1.type === "linear" && c2.type === "linear") {
    return linearRelation(c1, c2);
  }
  return genericRelation(c1, c2);
};

const strokeRelation = function (
  stroke1: RenderedStroke,
  stroke2: RenderedStroke,
): StrokeRelation {
  const strokeRelation: StrokeRelation = [];
  for (const curve1 of stroke1.curveList) {
    for (const curve2 of stroke2.curveList) {
      strokeRelation.push(curveRelation(curve1, curve2));
    }
  }
  return strokeRelation;
};

type StrokeRelation = CurveRelation[];

const renderSVGStroke = ({ feature, start, curveList }: SVGStroke) => {
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

const renderSVGGlyph = (glyph: SVGGlyph) => glyph.map(renderSVGStroke);

const findTopology = (renderedGlyph: RenderedGlyph) => {
  const matrix = [] as StrokeRelation[][];
  for (const [index1, stroke1] of renderedGlyph.entries()) {
    const row = [] as StrokeRelation[];
    for (const [index2, stroke2] of renderedGlyph.entries()) {
      if (index2 >= index1) break;
      row.push(strokeRelation(stroke1, stroke2));
    }
    matrix.push(row);
  }
  return matrix;
};

const getMatrixElement = (matrix: StrokeRelation[][], i: number, j: number) => {
  return i > j ? matrix[i]![j]! : matrix[j]![i]!;
};

export default findTopology;
export { curveRelation, strokeRelation, renderSVGStroke, renderSVGGlyph };
export type { CurveRelation, StrokeRelation, RenderedGlyph };
