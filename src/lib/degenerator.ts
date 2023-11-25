import { isEqual } from "~/lib/utils";
import type { Cache } from "./form";
import type { SVGGlyph } from "./data";
import { Component } from "./data";
import findTopology, { renderSVGGlyph } from "./topology";
import type { Interval } from "./bezier";
import { curveLength, isBoundedBy, isCollinear } from "./bezier";
import { Degenerator, FormConfig } from "./config";
import { Feature } from "./classifier";

export const indicesToBinary = (n: number) => (indices: number[]) => {
  let binaryCode = 0;
  for (const index of indices) {
    binaryCode += 1 << (n - index - 1);
  }
  return binaryCode;
};

export const binaryToIndices = (n: number) => (binary: number) => {
  const indices = [...Array(n).keys()];
  return indices.filter((index) => binary & (1 << (n - index - 1)));
};

const strokeFeatureEqual = (
  degenerator: Degenerator,
  s1: Feature,
  s2: Feature,
) => {
  const { feature } = degenerator;
  return feature[s1] === feature[s2];
};

const verifySpecialRoots = (
  component: Cache,
  root: Cache,
  indices: number[],
) => {
  if (["土", "士"].includes(root.name)) {
    const [i1, _, i3] = indices as [number, number, number];
    const upperHeng = component.glyph[i1]!.curveList[0]!;
    const lowerHeng = component.glyph[i3]!.curveList[0]!;
    const lowerIsLonger = curveLength(upperHeng) < curveLength(lowerHeng);
    return root.name === "土" ? lowerIsLonger : !lowerIsLonger;
  }
  if (["口", "囗"].includes(root.name)) {
    if (["囗", "\ue02d"].includes(component.name)) {
      return root.name === "囗";
    }
    const [i1, _, i3] = indices as [number, number, number];
    const upperLeft = component.glyph[i1]!.curveList[0]!.controls[0];
    const lowerRight = component.glyph[i3]!.curveList[0]!.controls.at(-1)!;
    const xrange: Interval = [upperLeft[0], lowerRight[0]];
    const yrange: Interval = [upperLeft[1], lowerRight[1]];
    const otherStrokes = component.glyph.filter(
      (_, index) => !indices.includes(index),
    );
    const containsStroke = otherStrokes.some((stroke) =>
      isBoundedBy(stroke, xrange, yrange),
    );
    return root.name === "囗" ? containsStroke : !containsStroke;
  }
  if (["\ue087" /* 木末二 */, "\ue43d" /* 全字头 */].includes(root.name)) {
    const [i1] = indices as [number];
    const attachPoint = component.glyph[i1]!.curveList[0]!.controls[0];
    const otherStrokes = component.glyph.filter(
      (_, index) => !indices.includes(index),
    );
    const otherCurves = otherStrokes.map((s) => s.curveList).flat();
    const pieAndNaIsSeparated = otherCurves.some(
      (x) =>
        x.type === "linear" &&
        isCollinear(x.controls[0], x.controls[1], attachPoint),
    );
    return root.name === "\ue087" ? pieAndNaIsSeparated : !pieAndNaIsSeparated;
  }
  return true;
};

export const generateSliceBinaries = (
  config: FormConfig,
  component: Cache,
  root: Cache,
) => {
  const {
    analysis: { degenerator },
  } = config;
  const { glyph: cglyph, topology: ctopology } = component;
  const { glyph: rglyph, topology: rtopology } = root;
  if (cglyph.length < rglyph.length) return [];
  let queue = [[]] as number[][];
  for (const [rIndex, rStroke] of rglyph.entries()) {
    const rStrokeTopology = rtopology[rIndex];
    const end = cglyph.length - rglyph.length + rIndex + 1;
    for (let _ = queue.length; _ !== 0; --_) {
      const indexList = queue.shift()!;
      const start = indexList.length ? indexList.at(-1)! + 1 : 0;
      for (const [cIndex, cStroke] of cglyph.slice(start, end).entries()) {
        if (!strokeFeatureEqual(degenerator, cStroke.feature, rStroke.feature))
          continue;
        const realIndex = cIndex + start;
        const cStrokeTopology = ctopology[realIndex]!.filter((_, i) =>
          indexList.includes(i),
        );
        if (!isEqual(cStrokeTopology, rStrokeTopology)) continue;
        queue.push(indexList.concat(realIndex));
      }
    }
    if (!queue) return [];
  }
  if (degenerator.nocross) {
    const allindices = [...Array(cglyph.length).keys()];
    queue = queue.filter((indices) => {
      const others = allindices.filter((x) => !indices.includes(x));
      const allCombinations = indices
        .map((x) => others.map((y) => [x, y].sort() as [number, number]))
        .flat();
      return allCombinations.every(([x, y]) => {
        const relation = ctopology[y]![x]!;
        return relation.every((cr) => cr.type !== "交");
      });
    });
  }
  return queue
    .filter((x) => verifySpecialRoots(component, root, x))
    .map(indicesToBinary(cglyph.length));
};

const degenerate = (degenerator: Degenerator, glyph: SVGGlyph) => {
  return [
    glyph.map((x) => x.feature).map((x) => degenerator.feature[x] || x),
    findTopology(renderSVGGlyph(glyph)),
  ] as const;
};

export default degenerate;
