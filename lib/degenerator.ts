import assert from "assert";
import { Glyph } from "./data";
import { Relation } from "./topology";
import _ from "underscore";
import { ComponentData } from "./chai";

const indexListToBinary = (n: number) => (indices: number[]) => {
  let binaryCode = 0;
  for (const index of indices) {
    binaryCode += 1 << (n - index - 1);
  }
  return binaryCode;
};

const strokeFeatureEqual = (s1: string, s2: string) => {
  const simplifyMap = new Map<string, string>([["捺", "点"]]);
  const simplify = (s: string) => simplifyMap.get(s) || s;
  return simplify(s1) === simplify(s2);
};

export const generateSliceBinaries = (
  component: ComponentData,
  root: ComponentData,
) => {
  const { name: cname, glyph: cglyph, topology: ctopology } = component;
  const { name: rname, glyph: rglyph, topology: rtopology } = root;
  if (cglyph.length < rglyph.length) return [];
  const queue = [[]] as number[][];
  for (const [rIndex, rStroke] of rglyph.entries()) {
    const rStrokeTopology = rtopology[rIndex];
    const end = cglyph.length - rglyph.length + rIndex + 1;
    const l = queue.length;
    for (let i = 0; i != l; ++i) {
      const indexList = queue.shift()!;
      const start = indexList.length ? indexList[indexList.length - 1] + 1 : 0;
      for (let cIndex = start; cIndex != end; ++cIndex) {
        const cStroke = cglyph[cIndex];
        if (!strokeFeatureEqual(cStroke.feature, rStroke.feature)) continue;
        const cStrokeTopology = ctopology[cIndex].filter((_, i) =>
          indexList.includes(i),
        );
        console.assert(
          cStrokeTopology.flat().length === rStrokeTopology.flat().length,
        );
        if (!_.isEqual(cStrokeTopology, rStrokeTopology)) continue;
        queue.push(indexList.concat(cIndex));
      }
    }
    if (!queue) return [];
  }
  return queue.map(indexListToBinary(cglyph.length));
};
