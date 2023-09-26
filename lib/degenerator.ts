import { isEqual } from "underscore";
import { ComponentData } from "./chai";

export const indicesToBinary = (n: number) => (indices: number[]) => {
  let binaryCode = 0;
  for (const index of indices) {
    binaryCode += 1 << (n - index - 1);
  }
  return binaryCode;
};

export const binaryToIndices = (n: number) => (binary: number) => {
  const indices = [...Array(n).keys()];
  const b = 1 << (n - 1);
  return indices.filter((i) => binary & (b >> i));
};

const strokeFeatureEqual = (s1: string, s2: string) => {
  const simplifyMap = new Map<string, string>([
    ["捺", "点"],
    ["提", "横"],
  ]);
  const simplify = (s: string) => simplifyMap.get(s) || s;
  return simplify(s1) === simplify(s2);
};

export const generateSliceBinaries = (
  component: ComponentData,
  root: ComponentData,
) => {
  const { glyph: cglyph, topology: ctopology } = component;
  const { glyph: rglyph, topology: rtopology } = root;
  if (cglyph.length < rglyph.length) return [];
  let queue = [[]] as number[][];
  for (const [rIndex, rStroke] of rglyph.entries()) {
    const rStrokeTopology = rtopology[rIndex];
    const end = cglyph.length - rglyph.length + rIndex + 1;
    for (let _ = queue.length; _ != 0; --_) {
      const indexList = queue.shift()!;
      const start = indexList.length ? indexList[indexList.length - 1] + 1 : 0;
      for (let cIndex = start; cIndex != end; ++cIndex) {
        const cStroke = cglyph[cIndex];
        if (!strokeFeatureEqual(cStroke.feature, rStroke.feature)) continue;
        const cStrokeTopology = ctopology[cIndex].filter((_, i) =>
          indexList.includes(i),
        );
        if (!isEqual(cStrokeTopology, rStrokeTopology)) continue;
        queue.push(indexList.concat(cIndex));
      }
    }
    if (!queue) return [];
  }
  return queue.map(indicesToBinary(cglyph.length));
};
