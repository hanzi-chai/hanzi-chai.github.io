import { Glyph } from "./data";

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

export const generateSliceBinaries = (component: Glyph, root: Glyph) => {
  if (component.length < root.length) return [];
  const queue = [[]] as number[][];
  for (const [rIndex, rStroke] of root.entries()) {
    const end = component.length - root.length + rIndex + 1;
    const l = queue.length;
    for (let i = 0; i != l; ++i) {
      const indexList = queue.shift()!;
      const start = indexList.length ? indexList[indexList.length - 1] + 1 : 0;
      const interval = component.slice(start, end);
      for (const [cIndex, cStroke] of interval.entries()) {
        if (!strokeFeatureEqual(cStroke.feature, rStroke.feature)) continue;
        // TODO: compare topology
        queue.push(indexList.concat(cIndex + start));
      }
    }
    if (!queue) return [];
  }
  return queue.map(indexListToBinary(component.length));
};
