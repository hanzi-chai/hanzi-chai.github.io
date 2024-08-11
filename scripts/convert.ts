import { readFileSync, writeFileSync } from "fs";

const zhenma = readFileSync(
  "/Users/tansongchen/Downloads/zhenma-raw.txt",
  "utf-8",
).split("\n");
const entries: [string, string][] = [];

for (const line of zhenma) {
  const [key, ...rest] = line.split(" ");
  rest.forEach((value) => {
    entries.push([key!, value]);
  });
}

writeFileSync(
  "/Users/tansongchen/Downloads/zhenma.txt",
  entries.map(([key, value]) => `${value}\t${key}`).join("\n"),
);
