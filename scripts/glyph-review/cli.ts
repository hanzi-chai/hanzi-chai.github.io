import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type {
  基本字形数据,
  字符数据,
} from "../../packages/hanzi-chai/src/data";
import { UNICODE_VERSION } from "../unicode";
import {
  人工范围,
  候选生成器,
  在人工范围,
  字形签名,
  读取来源,
} from "./candidates";
import { 字形渲染器 } from "./render";

const ROOT = resolve(import.meta.dir, "../..");
const UNICODE = join(ROOT, "output/glyph-review/unicode", UNICODE_VERSION);
const DATA = join(ROOT, "packages/hanzi-chai/src/data");
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8"));
const write = (path: string, value: unknown) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const code = (cp: number) => cp.toString(16).toUpperCase().padStart(4, "0");
const imageKey = (cp: number, source: string) => `${code(cp)}-${source}`;

type 图像记录 = {
  page: number;
  reference: string;
  image: string;
  rowImage: string;
  glyphBox: number[];
};
type 索引 = {
  unicodeVersion: string;
  pdfSha256: string;
  irgSha256: string;
  records: Record<string, 图像记录>;
  issues: unknown[];
};
type 任务 = {
  id: string;
  unicode: number;
  character: string;
  source: string;
  irgSource: string;
  sourceReferences: string[];
  referenceSource: string;
  target: 图像记录 | null;
  reference: 图像记录 | null;
  baseline: string | null;
  candidates: (ReturnType<候选生成器["生成"]>[number] & {
    image: string;
    svg: string;
  })[];
  flags: string[];
  renderingErrors: { candidateKey: string; reason: string }[];
};
type 批次 = {
  batchId: string;
  unicodeVersion: string;
  generatedAt: string;
  mode: string;
  inputHashes: Record<string, string>;
  training: Record<string, unknown>;
  tasks: 任务[];
};
type 判定 = {
  batchId: string;
  taskId: string;
  phase1: { relation: string; difference: string };
  verdict: "candidate" | "none" | "uncertain";
  candidateKey: string | null;
  reason: string;
  reviewer: { kind: "human" | "agent"; name: string };
  reviewedAt: string;
};

function 帮助() {
  console.log(`Unicode 18.0 离线字形核验原型（不会写入 API 数据库）

准备：python3 scripts/glyph-review/unicode_pdf.py download --sync
索引：uv run --python 3.14 --with pymupdf==2.0 python scripts/glyph-review/unicode_pdf.py index
生成：bun scripts/glyph-review/cli.ts generate --from 6901 --to 7A6F --limit 100 --out output/glyph-review/pilot
盲测：bun scripts/glyph-review/cli.ts generate --holdout --limit 300 --seed unicode18 --out output/glyph-review/holdout
可选：--sources J,T,N（用项目来源标记），--candidates 6，--no-images（仅生成数据）
导入：bun scripts/glyph-review/cli.ts import --out <批次目录> --file <核验 JSON>
统计：bun scripts/glyph-review/cli.ts summary --out <批次目录>
回看旧标注覆盖率：bun scripts/glyph-review/cli.ts score --out <盲测目录>

生成后直接打开批次目录的 review.html；agent 使用 agent-stage1.json / agent-stage2.json。`);
}

function 码位(value: string) {
  if (!/^(?:U\+|0x)?[0-9a-f]{4,6}$/i.test(value))
    throw new Error(`无效码位：${value}`);
  const result = Number.parseInt(value.replace(/^(U\+|0x)/i, ""), 16);
  if (result < 0x4e00 || result > 0x9fff)
    throw new Error("本原型仅支持 CJK 基本集");
  return result;
}

async function 生成(values: Record<string, string | boolean | undefined>) {
  const out = resolve(String(values.out ?? "output/glyph-review/pilot"));
  if (existsSync(join(out, "tasks.json")))
    throw new Error("批次已存在，请使用新的 --out 目录以保留核验记录");
  const limit = Number(values.limit ?? 100);
  const candidateLimit = Number(values.candidates ?? 6);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20992)
    throw new Error("--limit 须为 1～20992");
  if (
    !Number.isInteger(candidateLimit) ||
    candidateLimit < 2 ||
    candidateLimit > 12
  )
    throw new Error("--candidates 须为 2～12");
  const from = 码位(String(values.from ?? "6901"));
  const to = 码位(String(values.to ?? "7A6F"));
  if (from > to) throw new Error("起始码位大于结束码位");
  const charactersText = readFileSync(join(DATA, "characters.json"), "utf8");
  const glyphsText = readFileSync(join(DATA, "glyphs.json"), "utf8");
  const irgText = readFileSync(join(UNICODE, "Unihan_IRGSources.txt"), "utf8");
  if (!irgText.includes(`# Unicode Version ${UNICODE_VERSION}\n`))
    throw new Error("IRGSources 不是 Unicode 18.0");
  const characters: 字符数据[] = JSON.parse(charactersText);
  const glyphs: 基本字形数据[] = JSON.parse(glyphsText);
  const sources = 读取来源(irgText);
  const index = read<索引>(join(UNICODE, "index.json"));
  if (
    index.unicodeVersion !== UNICODE_VERSION ||
    index.irgSha256 !== hash(irgText) ||
    index.pdfSha256 !== hash(readFileSync(join(UNICODE, "U4E00.pdf")))
  )
    throw new Error("码表、来源表与索引不匹配，请重新生成索引");
  const holdout = values.holdout === true;
  const selected = characters.filter(
    (c) =>
      sources.has(c.unicode) &&
      (holdout ? 在人工范围(c.unicode) : c.unicode >= from && c.unicode <= to),
  );
  if (holdout) {
    const seed = String(values.seed ?? "unicode18");
    selected.sort((a, b) =>
      hash(`${seed}:${a.unicode}`).localeCompare(hash(`${seed}:${b.unicode}`)),
    );
  } else selected.sort((a, b) => a.unicode - b.unicode);
  const chosen = selected.slice(0, limit);
  if (!chosen.length) throw new Error("指定范围内没有可处理字符");
  // 整字留出：该字符的任何来源均不进入部件统计和整字映射。
  const excluded = new Set(chosen.map((c) => c.unicode));
  const engine = new 候选生成器(characters, glyphs, excluded);
  const glyphMap = new Map(glyphs.map((g) => [g.id, g]));
  const renderer = new 字形渲染器(glyphMap);
  mkdirSync(join(out, "renders"), { recursive: true });
  const filters = values.sources
    ? new Set(String(values.sources).split(","))
    : null;
  const validSources = new Set(
    [...sources.values()].flatMap((m) => [...m.keys()]),
  );
  if (filters && [...filters].some((s) => !validSources.has(s)))
    throw new Error("--sources 含有未知来源，请使用 G,H,T,J,K,N,V,M,S,B,U");
  const tasks: 任务[] = [];
  const expected: Record<string, { signature: string; changed: boolean }> = {};
  const images = new Set<string>();
  const imageRecord = (key: string) => {
    const record = index.records[key];
    return record
      ? {
          ...record,
          image: `images/${key}.png`,
          rowImage: `images/${key.split("-")[0]}-row.png`,
        }
      : null;
  };
  for (const character of chosen) {
    const base = engine.获取参考(character);
    if (!base) continue;
    let baseline: string | null =
      `renders/${code(character.unicode)}-baseline.png`;
    try {
      writeFileSync(
        join(out, baseline.replace(/\.png$/, ".svg")),
        renderer.渲染(base.glyph),
      );
    } catch {
      baseline = null;
    }
    for (const [source, sourceInfo] of sources.get(character.unicode)!) {
      if (filters && !filters.has(source)) continue;
      const id = imageKey(character.unicode, source);
      const referenceKey = imageKey(character.unicode, base.source);
      images.add(id);
      images.add(referenceKey);
      const flags = ["historical-anchors-not-yet-reverified-for-unicode18"];
      if (base.source !== "G") flags.push("non-G-reference");
      if (!index.records[id] || !index.records[referenceKey])
        flags.push("missing-pdf-image");
      if (!baseline) flags.push("reference-render-failed");
      if (base.glyph.type === "component") flags.push("component-reference");
      const candidates: 任务["candidates"] = [];
      const renderingErrors: 任务["renderingErrors"] = [];
      for (const candidate of engine.生成(character, source, candidateLimit)) {
        const svg = `renders/${id}-${candidate.key}.svg`;
        try {
          writeFileSync(join(out, svg), renderer.渲染(candidate.glyph));
          candidates.push({
            ...candidate,
            svg,
            image: svg.replace(/\.svg$/, ".png"),
          });
        } catch (error) {
          renderingErrors.push({
            candidateKey: candidate.key,
            reason: String(error),
          });
        }
      }
      if (
        source !== base.source &&
        !candidates.some((c) => c.evidence.some((e) => e.support > 0))
      )
        flags.push("no-supported-rule");
      if (!candidates.length) flags.push("no-renderable-candidate");
      tasks.push({
        id,
        unicode: character.unicode,
        character: String.fromCodePoint(character.unicode),
        source,
        ...sourceInfo,
        sourceReferences: sourceInfo.references,
        referenceSource: base.source,
        target: imageRecord(id),
        reference: imageRecord(referenceKey),
        baseline,
        candidates,
        flags,
        renderingErrors,
      });
      if (holdout) {
        const known = character.glyphs.find((g) => g.sources.includes(source));
        const glyph = known && glyphMap.get(known.id);
        if (glyph)
          expected[id] = {
            signature: 字形签名(glyph),
            changed: 字形签名(glyph) !== 字形签名(base.glyph),
          };
      }
    }
  }
  if (!tasks.length) throw new Error("来源过滤后没有任务");
  const inputHashes = {
    characters: hash(charactersText),
    glyphs: hash(glyphsText),
    irgSources: hash(irgText),
    pdf: index.pdfSha256,
  };
  const batch: 批次 = {
    batchId: hash(JSON.stringify({ inputHashes, tasks })).slice(0, 20),
    unicodeVersion: UNICODE_VERSION,
    generatedAt: new Date().toISOString(),
    mode: holdout ? "historical-holdout" : "pilot",
    inputHashes,
    training: {
      historicalRanges: 人工范围,
      excludedCharacters: [...excluded],
      characterCount: engine.trainingCharacters,
      skippedStructuralPairs: engine.skippedStructuralPairs,
      provenance:
        "existing-human-annotations; Unicode 18 visual equivalence remains unverified",
      rankingScore: "ranking heuristic, not a calibrated probability",
    },
    tasks,
  };
  write(join(out, "tasks.json"), batch);
  write(join(out, "crop-request.json"), [...images]);
  if (holdout) write(join(out, "heldout-private.json"), expected);
  if (!values["no-images"]) {
    const result = Bun.spawnSync(
      [
        "uv",
        "run",
        "--offline",
        "--python",
        "3.14",
        "--with",
        "pymupdf==2.0",
        "python",
        join(import.meta.dir, "unicode_pdf.py"),
        "crop",
        "--request",
        join(out, "crop-request.json"),
        "--out",
        join(out, "images"),
        "--renders",
        join(out, "renders"),
      ],
      { stdout: "inherit", stderr: "inherit" },
    );
    if (result.exitCode !== 0)
      throw new Error(
        "图像生成失败；数据已保存，可按 README 的恢复命令重新裁图",
      );
  }
  const packet = (task: 任务, stage: 1 | 2) => ({
    batchId: batch.batchId,
    taskId: task.id,
    unicodeVersion: UNICODE_VERSION,
    targetImage: task.target ? resolve(out, task.target.image) : null,
    referenceImage: task.reference ? resolve(out, task.reference.image) : null,
    rowImage: task.target ? resolve(out, task.target.rowImage) : null,
    source: task.source,
    sourceReferences: task.sourceReferences,
    flags: task.flags,
    ...(stage === 2
      ? {
          candidates: task.candidates.map((c) => ({
            key: c.key,
            image: resolve(out, c.image),
            evidence: c.evidence,
          })),
        }
      : {}),
  });
  write(join(out, "agent-stage1.json"), {
    instruction:
      "先独立比较来源原图，输出 relation=same/different/uncertain 和可定位的 difference。忽略纯粗细、衬线、比例差异；关注笔画增减、连接及部件结构。看不清或缺图必须 uncertain。静态图片不推断笔顺。此阶段不可读取候选和 heldout-private.json。",
    tasks: tasks.map((t) => packet(t, 1)),
  });
  write(join(out, "agent-stage2.json"), {
    instruction:
      "仅在完成第一阶段后打开。逐项检查候选与目标的结构和笔画，选择 candidate/none/uncertain，并给出视觉依据；允许全部不匹配。模型自报置信度不能作为入库依据。输出格式见 README。",
    tasks: tasks.map((t) => packet(t, 2)),
  });
  const html = readFileSync(join(import.meta.dir, "review.html"), "utf8")
    .replace("__BATCH_DATA__", JSON.stringify(batch).replaceAll("<", "\\u003c"))
    .replace("__INITIAL_DECISIONS__", "[]");
  writeFileSync(join(out, "review.html"), html);
  console.log(
    JSON.stringify(
      {
        out,
        batchId: batch.batchId,
        characters: chosen.length,
        tasks: tasks.length,
        candidates: tasks.reduce((sum, t) => sum + t.candidates.length, 0),
        missingImages: tasks.filter((t) => !t.target || !t.reference).length,
      },
      null,
      2,
    ),
  );
}

function 校验判定(value: 判定, batch: 批次, out: string) {
  const task = batch.tasks.find((t) => t.id === value.taskId);
  if (!task || value.batchId !== batch.batchId)
    throw new Error("判定不属于当前批次");
  if (
    !value.phase1 ||
    !["same", "different", "uncertain"].includes(value.phase1.relation) ||
    typeof value.phase1.difference !== "string"
  )
    throw new Error(`${value.taskId} 缺少第一阶段观察`);
  if (value.phase1.relation === "different" && !value.phase1.difference.trim())
    throw new Error("差异需要明确说明位置和内容");
  if (!["candidate", "none", "uncertain"].includes(value.verdict))
    throw new Error("未知判定");
  if (typeof value.reason !== "string" || !value.reason.trim())
    throw new Error("判定需要视觉依据");
  if (
    !["human", "agent"].includes(value.reviewer?.kind) ||
    !value.reviewer?.name?.trim() ||
    !Number.isFinite(Date.parse(value.reviewedAt))
  )
    throw new Error("核验者或时间缺失");
  if (
    value.verdict === "candidate" &&
    (!task.target ||
      !task.reference ||
      !existsSync(join(out, task.target.image)) ||
      !existsSync(join(out, task.reference.image)) ||
      value.phase1.relation === "uncertain" ||
      !task.candidates.some((c) => c.key === value.candidateKey))
  )
    throw new Error("候选不存在、原图缺失或第一阶段不确定，不能判为通过");
  if (value.verdict !== "candidate" && value.candidateKey !== null)
    throw new Error("非候选判定的 candidateKey 必须为 null");
}

function 后处理(
  command: string,
  values: Record<string, string | boolean | undefined>,
) {
  const out = resolve(String(values.out ?? "output/glyph-review/pilot"));
  const batch = read<批次>(join(out, "tasks.json"));
  const path = join(out, "decisions.json");
  let decisions = existsSync(path) ? read<判定[]>(path) : [];
  if (command === "import") {
    if (!values.file) throw new Error("需要 --file 核验 JSON");
    const incoming = read<{ decisions: 判定[] } | 判定[]>(
      resolve(String(values.file)),
    );
    const rows = Array.isArray(incoming) ? incoming : incoming.decisions;
    if (!Array.isArray(rows)) throw new Error("核验文件需要 decisions 数组");
    for (const row of rows) 校验判定(row, batch, out);
    const byTask = new Map(decisions.map((d) => [d.taskId, d]));
    // 人工核验结果不能被后续 agent 导入悄悄覆盖。
    for (const row of rows) {
      const previous = byTask.get(row.taskId);
      if (previous?.reviewer.kind === "human" && row.reviewer.kind === "agent")
        throw new Error(`${row.taskId} 已有人工判定`);
      byTask.set(row.taskId, row);
    }
    decisions = [...byTask.values()];
    if (existsSync(path))
      writeFileSync(
        join(out, `decisions-${Date.now()}.backup.json`),
        readFileSync(path),
      );
    write(path, decisions);
    const html = readFileSync(join(import.meta.dir, "review.html"), "utf8")
      .replace(
        "__BATCH_DATA__",
        JSON.stringify(batch).replaceAll("<", "\\u003c"),
      )
      .replace(
        "__INITIAL_DECISIONS__",
        JSON.stringify(decisions).replaceAll("<", "\\u003c"),
      );
    writeFileSync(join(out, "review.html"), html);
  }
  if (command === "score") {
    const expected = read<
      Record<string, { signature: string; changed: boolean }>
    >(join(out, "heldout-private.json"));
    const groups = {
      all: { count: 0, top1: 0, covered: 0 },
      changed: { count: 0, top1: 0, covered: 0 },
      unchanged: { count: 0, top1: 0, covered: 0 },
    };
    for (const task of batch.tasks) {
      const truth = expected[task.id];
      if (!truth || task.source === task.referenceSource) continue;
      const matches = task.candidates.map(
        (c) => 字形签名(c.glyph) === truth.signature,
      );
      for (const group of [
        groups.all,
        truth.changed ? groups.changed : groups.unchanged,
      ]) {
        group.count++;
        if (matches[0]) group.top1++;
        if (matches.some(Boolean)) group.covered++;
      }
    }
    const result = {
      warning:
        "仅对旧人工数据的结构签名回看；不代表 Unicode 18.0 视觉准确率，且非按部件族划分。",
      groups,
    };
    write(join(out, "coverage.json"), result);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const counts: Record<string, number> = {};
  for (const d of decisions)
    counts[`${d.reviewer.kind}:${d.verdict}`] =
      (counts[`${d.reviewer.kind}:${d.verdict}`] ?? 0) + 1;
  console.log(
    JSON.stringify(
      {
        batchId: batch.batchId,
        tasks: batch.tasks.length,
        reviewed: decisions.length,
        pending: batch.tasks.length - decisions.length,
        counts,
      },
      null,
      2,
    ),
  );
}

try {
  const { positionals, values } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      out: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      limit: { type: "string" },
      candidates: { type: "string" },
      sources: { type: "string" },
      seed: { type: "string" },
      file: { type: "string" },
      holdout: { type: "boolean" },
      "no-images": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  const command = positionals[0];
  if (!command || values.help) 帮助();
  else if (command === "generate") await 生成(values);
  else if (["import", "summary", "score"].includes(command))
    后处理(command, values);
  else throw new Error(`未知命令：${command}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
