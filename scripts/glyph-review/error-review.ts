import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

type Kind = "missing" | "rejected" | "wrong";
type Row = {
  taskId: string;
  source: string;
  scorable: boolean;
  agentCorrect: boolean | null;
  candidateCovered: boolean | null;
  agentChoice: string | null;
  reason: string;
  statisticalCorrect: boolean | null;
};
type BlindTask = {
  taskId: string;
  unicode: number;
  source: string;
  targetImage: string;
  candidates: { key: string; image: string }[];
  panel?: string;
  round?: number;
};
type Shape = { signature: string; render: string };
const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8"));
const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const labels: Record<Kind, string> = {
  missing: "候选缺失",
  rejected: "有候选但误拒",
  wrong: "有候选但选错",
};

/** 只读冻结批次；报告含答案，必须写在 blind/ 之外。 */
export function buildErrorReview(batchPath: string, outputPath?: string) {
  const batch = resolve(batchPath),
    output = resolve(outputPath ?? join(batch, "error-review.html"));
  const inBlind = relative(join(batch, "blind"), output);
  if (
    (!inBlind.startsWith("..") && !inBlind.startsWith("/")) ||
    extname(output) !== ".html"
  )
    throw Error("含答案的 HTML 必须位于 blind/ 之外，且使用 .html 扩展名");
  const hashes: Record<string, string> = {};
  const input = <T>(name: string): T => {
    const path = join(batch, name);
    hashes[name] = hash(readFileSync(path));
    return read<T>(path);
  };
  const evaluation = input<{
    overall: { total: number; agentCorrect: number; candidateCovered: number };
  }>("evaluation.json").overall;
  const rows = input<Row[]>("evaluation-rows.json");
  const choices = input<Record<string, Record<string, Shape>>>(
    "choices-private.json",
  );
  const truth = input<Record<string, Shape>>("truth-private.json");
  const blind = input<BlindTask[]>("blind/tasks.json");
  const tasks = new Map(blind.map((t) => [t.taskId, t]));
  const panels = new Map<number, string>();
  for (const name of readdirSync(join(batch, "blind/assignments"))
    .filter((n) => /^shard-\d+\.json$/.test(n))
    .sort()) {
    const assignment = input<{
      characters: { unicode: number; panel: string }[];
    }>(`blind/assignments/${name}`);
    for (const character of assignment.characters)
      panels.set(character.unicode, character.panel);
  }
  const submissions = new Map<
    string,
    { choice: string | null; reason: string; reviewer: string }
  >();
  for (const name of readdirSync(join(batch, "blind/results"))
    .filter((n) => /^shard-\d+\.json$/.test(n))
    .sort()) {
    const result = input<{
      reviewer: string;
      decisions: {
        taskId: string;
        choice: string | null;
        reason: string;
        reviewer?: string;
      }[];
    }>(`blind/results/${name}`);
    for (const d of result.decisions) {
      if (submissions.has(d.taskId)) throw Error(`重复提交：${d.taskId}`);
      submissions.set(d.taskId, {
        ...d,
        reviewer: d.reviewer ?? result.reviewer,
      });
    }
  }
  if (existsSync(join(batch, "agent-submissions.json"))) {
    const manifest = input<{ submissions: { path: string; sha256: string }[] }>(
      "agent-submissions.json",
    );
    for (const submission of manifest.submissions)
      if (
        hashes[`blind/results/${basename(submission.path)}`] !==
        submission.sha256
      )
        throw Error("原 agent 提交哈希不符，不能制作归因报告");
  }
  const eligible = rows.filter((r) => r.scorable),
    errors = eligible.filter((r) => r.agentCorrect === false);
  if (
    eligible.length !== evaluation.total ||
    eligible.length - errors.length !== evaluation.agentCorrect ||
    eligible.filter((r) => r.candidateCovered).length !==
      evaluation.candidateCovered
  )
    throw Error("逐项结果与汇总不符");
  const seen = new Set<string>();
  for (const row of rows) {
    const submitted = submissions.get(row.taskId);
    if (
      seen.has(row.taskId) ||
      !submitted ||
      submitted.choice !== row.agentChoice ||
      submitted.reason !== row.reason
    )
      throw Error(`评分行与原始提交不符：${row.taskId}`);
    seen.add(row.taskId);
  }
  const assets: Record<string, string> = {};
  const imageHashes: Record<string, string> = {};
  const asset = (p: string) => {
    const path = resolve(batch, p),
      bytes = readFileSync(path),
      digest = hash(bytes);
    const mime = (
      {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
      } as Record<string, string>
    )[extname(path)];
    if (!mime) throw Error(`不支持的 panel 图片格式：${path}`);
    assets[digest] ??= `data:${mime};base64,${bytes.toString("base64")}`;
    imageHashes[relative(batch, path)] = digest;
    return digest;
  };
  const grouped = new Map<number, Row[]>();
  for (const row of errors) {
    const task = tasks.get(row.taskId);
    if (!task) throw Error(`缺少盲选任务：${row.taskId}`);
    if (!grouped.has(task.unicode)) grouped.set(task.unicode, []);
    grouped.get(task.unicode)!.push(row);
  }
  const counts: Record<Kind, number> = { missing: 0, rejected: 0, wrong: 0 };
  const groups = [...grouped]
    .map(([unicode, errorRows]) => {
      const cp = unicode.toString(16).toUpperCase();
      const panel =
        tasks.get(errorRows[0]!.taskId)?.panel ?? panels.get(unicode);
      if (!panel) throw Error(`缺少原始 panel：${cp}`);
      const variants = new Map<
        string,
        { path: string; round?: number; taskIds: string[] }
      >();
      for (const row of errorRows) {
        const task = tasks.get(row.taskId)!,
          path = task.panel ?? panels.get(unicode)!;
        if (!variants.has(path))
          variants.set(path, { path, round: task.round, taskIds: [] });
        variants.get(path)!.taskIds.push(row.taskId);
      }
      return {
        id: cp,
        unicode,
        character: String.fromCodePoint(unicode),
        panel: asset(panel),
        panelVariants: [...variants.values()].map((v) => ({
          image: asset(v.path),
          label: `${v.round === undefined ? "当次" : v.round === 0 ? "首轮" : `深入第 ${v.round} 轮`}实际 panel · ${v.taskIds.join("、")}`,
        })),
        totalSources: blind.filter((t) => t.unicode === unicode).length,
        items: errorRows.map((row) => {
          const task = tasks.get(row.taskId)!,
            gold = truth[row.taskId];
          if (!gold) throw Error(`缺少冻结答案：${row.taskId}`);
          const correctKeys = Object.entries(choices[row.taskId]!)
            .filter(
              ([, c]) =>
                c.signature === gold.signature || c.render === gold.render,
            )
            .map(([key]) => key);
          if (Boolean(correctKeys.length) !== row.candidateCovered)
            throw Error(`候选覆盖与评分不符：${row.taskId}`);
          const kind: Kind = !correctKeys.length
            ? "missing"
            : row.agentChoice === null
              ? "rejected"
              : "wrong";
          counts[kind]++;
          const findImage = (key: string) => {
            const candidate = task.candidates.find((c) => c.key === key);
            if (!candidate) throw Error(`找不到候选 ${row.taskId}:${key}`);
            return asset(candidate.image);
          };
          const explanation =
            kind === "missing"
              ? `按冻结的结构签名或 SVG 路径判定，候选中没有历史标注对应项。${row.agentChoice === null ? "agent 已拒绝，本项仍按原口径计错。" : `agent 选择了 ${row.agentChoice}。`}需要人工区分候选遗漏、历史标注问题和视觉等价判定差异。`
              : kind === "rejected"
                ? `历史正确候选为 ${correctKeys.join("、")}，agent 输出全部不匹配。`
                : `历史正确候选为 ${correctKeys.join("、")}，agent 选择了 ${row.agentChoice}。`;
          return {
            id: row.taskId,
            source: row.source,
            kind,
            label: labels[kind],
            choice: row.agentChoice,
            correctKeys,
            explanation,
            reason: row.reason,
            reviewer: submissions.get(row.taskId)!.reviewer,
            statisticalCorrect: row.statisticalCorrect,
            target: asset(task.targetImage),
            selected:
              row.agentChoice === null ? null : findImage(row.agentChoice),
            correct: correctKeys.map((key) => ({ key, image: findImage(key) })),
          };
        }),
      };
    })
    .sort((a, b) => b.items.length - a.items.length || a.unicode - b.unicode);
  const data = {
    batch: basename(batch),
    generatedAt: new Date().toISOString(),
    total: evaluation.total,
    correct: evaluation.agentCorrect,
    errorCount: errors.length,
    characterCount: groups.length,
    counts,
    sources: [...new Set(errors.map((r) => r.source))].sort(),
    groups,
    assets,
    storageKey: `glyph-error-review:${hash(JSON.stringify(hashes)).slice(0, 24)}`,
  };
  const template = readFileSync(
    join(import.meta.dir, "error-review.html"),
    "utf8",
  );
  const html = template.replace(
    "__REVIEW_DATA__",
    JSON.stringify(data).replaceAll("<", "\\u003c"),
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html);
  const manifestPath = output.replace(/\.html$/, "-manifest.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ batch, output, generatedAt: data.generatedAt, total: data.total, correct: data.correct, errors: data.errorCount, characters: data.characterCount, counts, inputHashes: hashes, imageHashes, outputSha256: hash(html), taskIds: errors.map((r) => r.taskId) }, null, 2)}\n`,
  );
  return {
    output,
    manifestPath,
    errors: errors.length,
    characters: groups.length,
    counts,
  };
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { batch: { type: "string" }, out: { type: "string" } },
  });
  if (!values.batch)
    throw Error(
      "用法：bun scripts/glyph-review/error-review.ts --batch <冻结批次目录> [--out <HTML文件>]",
    );
  console.log(
    JSON.stringify(buildErrorReview(values.batch, values.out), null, 2),
  );
}
