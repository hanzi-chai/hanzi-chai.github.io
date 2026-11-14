/** 当量统计的文件/API 适配层；纯计算位于算法库。 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  type EquivalenceData,
  分析当量数据,
  序列化当量统计,
} from "../src/equivalence";

const { values } = parseArgs({
  options: {
    input: { type: "string" },
    out: { type: "string", default: "output/equivalence" },
  },
});
const data: EquivalenceData[] = values.input
  ? JSON.parse(readFileSync(values.input, "utf8"))
  : await (await import("./utils"))
      .get<EquivalenceData[]>("/equivalence")
      .then((result) => {
        if ("err" in result) throw new Error(result.msg);
        return result;
      });
const { 样本, 当量 } = 分析当量数据(data);
const output = path.resolve(values.out!);
mkdirSync(output, { recursive: true });
writeFileSync(
  path.join(output, "samples.json"),
  JSON.stringify(
    样本.map(({ set, data }) => ({ set: [...set], data })),
    null,
    2,
  ),
);
writeFileSync(
  path.join(output, "equivalence.tsv"),
  `${序列化当量统计(当量)
    .map((row) => row.join("\t"))
    .join("\n")}\n`,
);
console.log(`已统计 ${当量.length} 组当量，输出到 ${output}`);
