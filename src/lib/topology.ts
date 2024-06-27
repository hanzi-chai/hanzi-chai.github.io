import { isEqual } from "lodash-es";
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
  if (vc < 0 && uc < 0) {
    return { type: "交" };
  }
  return getDisjointRelation(a, b);
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

interface Topology {
  matrix: StrokeRelation[][];
  orientedPairs: [number, number][];
}

const isConforming = (r1: CurveRelation, r2: CurveRelation) => {
  switch (r1.type) {
    case "平行":
      return r2.type === "平行";
    case "散":
      return true;
    case "交":
      return (
        r2.type === "交" ||
        (r2.type === "连" && r2.second === "中") ||
        r2.type === "散"
      );
    case "连":
      if (r1.second === "中") {
        return (
          r2.type === "交" ||
          r2.type === "散" ||
          (r2.type === "连" && r2.second === "中")
        );
      }
      return (r2.type === "连" && r2.second === r1.second) || r2.type === "散";
  }
};

const findTopology = function (renderedGlyph: RenderedGlyph) {
  const topology: Topology = { matrix: [], orientedPairs: [] };
  for (const [index1, stroke1] of renderedGlyph.entries()) {
    const row = [] as StrokeRelation[];
    for (const [index2, stroke2] of renderedGlyph.entries()) {
      if (index1 === index2) row.push([]);
      else row.push(strokeRelation(stroke1, stroke2));
    }
    topology.matrix.push(row);
  }
  for (const [index1] of renderedGlyph.entries()) {
    for (const [index2] of renderedGlyph.entries()) {
      if (index2 >= index1) break;
      const relations = topology.matrix[index1]![index2]!;
      if (relations.some((v) => v.type === "交" || v.type === "连")) continue;
      const parallelIndex = relations.findIndex(
        (v) => v.type === "平行" && v.mainAxis === 0,
      );
      if (parallelIndex !== -1) {
        topology.orientedPairs.push([index1, index2]);
      }
      // 想要严谨判断同向笔画特别困难，先不搞了
      // if (parallelIndex === -1) continue;
      // // drop this shit and compute from ab initio
      // const index2Curves = renderedGlyph[index2]!.curveList;
      // // we have: parallelIndex = index1Index * index2Curves + index2Index
      // const index2Index = parallelIndex % index2Curves.length;
      // const index1Index = (parallelIndex - index2Index) / index2Curves.length;
      // // get all curves from all strokes other than k and l
      // const otherStrokes = [...renderedGlyph.keys()].filter(
      //   (_, index) => index !== index1 && index !== index2
      // );
      // if (
      //   otherStrokes.every((x) => {
      //     const r1 = topology.matrix[x]![index1]![index1Index]!;
      //     const r2 = topology.matrix[x]![index2]![index2Index]!;
      //     return isConforming(r1, r2) && isConforming(r2, r1);
      //   })
      // ) {
      //   topology.orientedPairs.push([index1, index2]);
      // }
    }
  }
  return topology;
};

export {
  isConforming,
  curveRelation,
  strokeRelation,
  renderSVGStroke,
  renderSVGGlyph,
  findTopology,
};
export type { CurveRelation, StrokeRelation, RenderedGlyph, Topology };
