import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  列出示例方案,
  获取示例方案路径,
  字集过滤查找表,
  评估方案项目,
  读取方案项目,
} from "../src/index";
import {
  applyExclusions,
  type CodeMap,
  compareTables,
  parseTable,
} from "./compare-code-tables";

const schemeIds = [
  "cqkm",
  "huma",
  "mswb",
  "sapphire",
  "tianma",
  "xkjd",
  "yustar",
  "zhangma",
  "zhenma",
];

const root = path.resolve(import.meta.dir, "..");
const { values } = parseArgs({
  options: {
    "reference-dir": { type: "string" },
    "base-url": {
      type: "string",
      default: "https://assets.chaifen.app/code-tables",
    },
    out: { type: "string", default: "output/code-table-report" },
    scheme: { type: "string" },
  },
});
const out = path.resolve(values.out!);
mkdirSync(out, { recursive: true });
const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");
async function readAsset(filename: string) {
  if (values["reference-dir"])
    return readFileSync(
      path.resolve(values["reference-dir"], filename),
      "utf8",
    );
  const url = `${values["base-url"]!.replace(/\/$/, "")}/${filename}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

type Manifest = {
  format_version: number;
  schemes: {
    id: string;
    file: string;
    sha256: string;
    characters: number;
    pairs: number;
  }[];
};
const results: Record<string, unknown>[] = [];
const lines = [
  "# 示例方案单字全码校对",
  "",
  `参考来源：${values["reference-dir"] ?? values["base-url"]}`,
  "",
  "在示例配置的字集内双向比较全码集合；同字异码保留，重复码对去重。",
  "",
  "| 方案 | 字集 | 目标字数 | 排除码对 | 完全相符 | 多码 | 缺码 | 参考缺字 | 生成缺字 | 结果 |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
];
const errors: string[] = [];
let failed = false;
try {
  const manifest: Manifest = JSON.parse(await readAsset("manifest.json"));
  if (manifest.format_version !== 1 || !Array.isArray(manifest.schemes))
    throw new Error("不支持的参考清单格式");
  writeFileSync(
    path.join(out, "reference-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const schemes = schemeIds.filter(
    (id) => !values.scheme || id === values.scheme,
  );
  if (!schemes.length) throw new Error(`没有可检查的示例：${values.scheme}`);
  for (const id of schemes) {
    try {
      const entry = manifest.schemes.find((item) => item.id === id);
      if (!entry || entry.file !== `${id}.tsv`)
        throw new Error("清单缺少方案或文件名不匹配");
      const text = await readAsset(entry.file);
      if (sha256(text) !== entry.sha256)
        throw new Error("参考表 SHA-256 与清单不符");
      const reference = parseTable(text);
      if (
        reference.size !== entry.characters ||
        [...reference.values()].reduce((n, codes) => n + codes.size, 0) !==
          entry.pairs
      )
        throw new Error("参考表字数或码对数与清单不符");
      const exclusionFile = path.join(root, "data", `${id}-excluded.tsv`);
      const exclusionText = existsSync(exclusionFile)
        ? readFileSync(exclusionFile, "utf8")
        : undefined;
      const exclusions =
        exclusionText === undefined
          ? undefined
          : {
              file: path.relative(root, exclusionFile),
              sha256: sha256(exclusionText),
              ...applyExclusions(reference, exclusionText),
            };
      const effectiveReference = [...reference]
        .flatMap(([character, codes]) =>
          [...codes].map((code) => `${character}\t${code}\n`),
        )
        .sort()
        .join("");
      const project = 读取方案项目(获取示例方案路径(id));
      const scopeName = project.配置.data?.character_set ?? "general";
      const scope = new Set(
        [...project.上下文.字库]
          .filter(([, data]) =>
            字集过滤查找表[scopeName]!(data.character, data),
          )
          .map(([codepoint]) => String.fromCodePoint(codepoint)),
      );
      if (!scope.size) throw new Error("目标字集为空");
      const record = 评估方案项目(project);
      const generated: CodeMap = new Map();
      for (const item of record.codes) {
        if ([...item.词].length !== 1 || !item.全码) continue;
        const codes = generated.get(item.词) ?? new Set<string>();
        codes.add(item.全码);
        generated.set(item.词, codes);
      }
      const comparison = compareTables(reference, generated, scope);
      const status = comparison.differences.length ? "不符" : "通过";
      if (comparison.differences.length) failed = true;
      const result = {
        id,
        scope: scopeName,
        status,
        reference_sha256: entry.sha256,
        reference_effective_sha256: sha256(effectiveReference),
        reference_exclusions: exclusions,
        metadata: record.metadata,
        ...comparison,
      };
      results.push(result);
      writeFileSync(
        path.join(out, `${id}.json`),
        `${JSON.stringify(result, null, 2)}\n`,
      );
      writeFileSync(
        path.join(out, `${id}.tsv`),
        `字\t参考全码\t生成全码\t多码\t缺码\n${comparison.differences.map((item) => [item.character, item.reference.join(" "), item.generated.join(" "), item.extra.join(" "), item.missing.join(" ")].join("\t")).join("\n")}\n`,
      );
      const row = `| ${id} | ${scopeName} | ${comparison.characters} | ${exclusions?.applied_pairs ?? 0} | ${comparison.exact} | ${comparison.extra} | ${comparison.missing} | ${comparison.reference_missing} | ${comparison.generated_missing} | ${status} |`;
      lines.push(row);
      console.log(row);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : String(error);
      results.push({ id: id, status: "错误", error: message });
      lines.push(`| ${id} | — | — | — | — | — | — | — | — | 错误 |`);
      errors.push(`校对错误（${id}）：${message.replace(/\n/g, " ")}`);
      console.error(`${id}: ${message}`);
    }
  }
  lines.push("", ...errors);
  const checked = new Set(schemeIds);
  const skipped = 列出示例方案()
    .filter(({ id }) => !checked.has(id))
    .map(({ id }) => `${id}.yaml`);
  lines.push(
    "",
    `未提供本地参考码表的示例（未校对）：${skipped.join("、")}`,
    "",
    "参考表包含官方兼容码和地区字形码；差异不一定表示算法错误，请按字形来源复核。完整差异见同名 TSV / JSON。",
    "已核实的排除项读取 data/<方案>-excluded.tsv，先校验原始参考表哈希和计数，再按字、全码排除。JSON 记录排除清单哈希、实际排除条目及排除后的参考表哈希。",
  );
} catch (error) {
  failed = true;
  const message = error instanceof Error ? error.message : String(error);
  lines.push("", `检查失败：${message}`);
  results.push({ status: "错误", error: message });
  console.error(message);
}
writeFileSync(
  path.join(out, "report.json"),
  `${JSON.stringify(results, null, 2)}\n`,
);
const markdown = `${lines.join("\n")}\n`;
writeFileSync(path.join(out, "report.md"), markdown);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
process.exitCode = failed ? 1 : 0;
