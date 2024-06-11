import { readFileSync } from "fs";
import { load } from "js-yaml";
import { examples } from "~/lib";

const estimate = (n: number, k: number) => (n * n) / (2 * k);

const makeMap = (filename: string) => {
  const content = readFileSync(filename, "utf-8").split("\n");
  return new Map(
    content.map((x) => {
      const [char, analysis_str] = x.split("\t") as [string, string];
      const analysis = analysis_str.split(" ");
      while (analysis.length < 3) analysis.push("");
      return [char, analysis] as [string, [string, string, string]];
    }),
  );
};

const calculate = (
  descendants: Map<string, string>,
  analysisMap: Map<string, [string, string, string]>,
) => {
  let total = 0;
  for (const [char, derivatives] of descendants) {
    const analysis = analysisMap.get(char);
    const derivAnalysis = [...derivatives]
      .map((x) => analysisMap.get(x))
      .filter((x) => x)
      .map((x) => x!.join(" "));
    if (!analysis) continue;
    const subseqs = [[0], [1], [2], [0, 1], [0, 2], [1, 2]];
    let best = 0;
    // find all subsequences
    for (const subseq of subseqs) {
      const hash = subseq.map((i) => analysis[i]).join(" ");
      const score =
        derivAnalysis.filter((x) => x.includes(hash)).length * subseq.length;
      if (score > best) {
        best = score;
      }
    }
    total += best;
  }
  console.log(total);
};

const analyze = (
  analysisMap: Map<string, [string, string, string]>,
  map: Record<string, string>,
  alphabet: number,
) => {
  const simpMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    for (const [index, char] of [...value].entries()) {
      simpMap[index ? `${key}.${index}` : key] = char;
    }
  }
  const map0 = new Map<string, string[]>();
  const map1 = new Map<string, string[]>();
  const map2 = new Map<string, string[]>();
  const codemap = new Map<string, [string, string, string][]>();
  let dup1 = 0;
  let dup2 = 0;
  let dup3 = 0;
  for (const [char, [a0, a1, a2]] of analysisMap) {
    const hash = `${a0} ${a1} ${a2}`;
    const hash01 = `${a0} ${a1} *`;
    const hash02 = `${a0} * ${a2}`;
    const hash12 = `* ${a1} ${a2}`;
    const hash0 = `${a0} * *`;
    const hash1 = `* ${a1} *`;
    const hash2 = `* * ${a2}`;
    const code = [a0, a1, a2].map((x) => simpMap[x] ?? "$").join("");
    const prev = codemap.get(code) ?? [];
    if (prev.length) {
      const toCompare = prev[0]!;
      const sameCount = [a0, a1, a2].filter(
        (x, i) => x === toCompare[i],
      ).length;
      if (sameCount >= 2) {
        dup1 += 1;
      }
      if (sameCount >= 1) {
        dup2 += 1;
      }
      dup3 += 1;
    }
    codemap.set(code, prev.concat([[a0, a1, a2]]));
    map0.set(hash, (map0.get(hash) ?? []).concat(char));
    for (const partial of [hash01, hash02, hash12]) {
      map1.set(partial, (map1.get(partial) ?? []).concat(char));
    }
    for (const partial of [hash0, hash1, hash2]) {
      map2.set(partial, (map2.get(partial) ?? []).concat(char));
    }
  }
  const dup0 = [...map0.values()]
    .filter((x) => x.length > 1)
    .reduce((a, b) => a + b.length - 1, 0);
  const estdup1 = [...map1.values()]
    .filter((x) => x.length > 1)
    .reduce((a, b) => a + estimate(b.length, alphabet), 0);
  // console.log([...map2].sort((a, b) => b[1].length - a[1].length).slice(0, 10))
  const estdup2 = [...map2.values()]
    .filter((x) => x.length > 1)
    .reduce((a, b) => a + estimate(b.length, alphabet * alphabet), 0);
  const estdup3 = estimate(analysisMap.size, alphabet * alphabet * alphabet);
  console.log({ dup0, dup1, estdup1, dup2, estdup2, dup3, estdup3 });
};

const yima_map = (load(readFileSync("examples/easy.yaml", "utf-8")) as any).form
  .mapping;
const yima_content = makeMap("public/cache/yima.txt");
const c42_map = Object.fromEntries(
  readFileSync("public/cache/keymap.dat", "utf-8")
    .trim()
    .split("\n")
    .map((x) => x.split("\t").slice(0, 2) as [string, string]),
);
const c42_content = makeMap("public/cache/c42.txt");
for (const char of "abcdefghijklmnopqrstuvwxyz") {
  c42_map[char] = char;
}
for (const char of yima_content.keys()) {
  if (!c42_content.has(char)) {
    yima_content.delete(char);
  }
}
for (const char of c42_content.keys()) {
  if (!yima_content.has(char)) {
    c42_content.delete(char);
  }
}
console.log(yima_content.size, c42_content.size);
analyze(yima_content, yima_map as Record<string, string>, 26);
analyze(c42_content, c42_map, 27);

const descendants = new Map(
  readFileSync("public/cache/descendants.txt", "utf-8")
    .split("\n")
    .map((x) => x.split("\t") as [string, string]),
);

calculate(descendants, yima_content);
calculate(descendants, c42_content);
