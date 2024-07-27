import { readFileSync, writeFileSync } from "fs";

interface R {
  char: string;
  hash: string;
}

const calculate = (
  descendants: Map<string, string>,
  analysisMap: Map<string, string[]>,
) => {
  let total = 0;
  let outlierMap = new Map<string, R[]>();
  for (const [char, derivatives] of descendants) {
    const analysis = analysisMap.get(char)!;
    const derivAnalysis: R[] = [];
    for (const derivative of derivatives) {
      const analysis = analysisMap.get(derivative)!;
      derivAnalysis.push({
        char: derivative,
        hash: analysis.join(" "),
      });
    }
    const subseqs = [[0], [1], [2], [0, 1], [0, 2], [1, 2]];
    let best = 0;
    let outliers: R[] = [];
    // find all subsequences
    for (const subseq of subseqs) {
      const hash = subseq
        .map((i) => analysis[i])
        .filter((x) => x !== undefined)
        .join(" ");
      const score =
        derivAnalysis.filter((x) => x.hash.includes(hash)).length *
        subseq.length;
      if (score > best) {
        best = score;
        outliers = derivAnalysis.filter((x) => !x.hash.includes(hash));
      }
    }
    total += best;
    outlierMap.set(char, outliers);
  }
  return { total, outlierMap };
};

const descendants = new Map(
  readFileSync("public/cache/descendants.txt", "utf-8")
    .split("\n")
    .map((x) => x.split("\t") as [string, string]),
);

const analysisMap = new Map(
  readFileSync("public/cache/c3.txt", "utf-8")
    .split("\n")
    .map((x) => {
      const [char, analysis] = x.split("\t") as [string, string];
      return [char, analysis.split(" ")] as [string, string[]];
    }),
);

const { total, outlierMap } = calculate(descendants, analysisMap);

console.log(total);

writeFileSync(
  "public/cache/outliers.txt",
  [...outlierMap]
    .map(
      ([char, outliers]) =>
        `${char}\t${outliers.map(({ char, hash }) => `${char}: ${hash}`).join(", ")}`,
    )
    .join("\n"),
);
