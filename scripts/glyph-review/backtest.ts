import { createHash, randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { Resvg } from "@resvg/resvg-js";
import type {
  基本字形数据,
  字符数据,
} from "../../packages/hanzi-chai/src/data";
import { type 候选, 在人工范围, 字形签名, 读取来源 } from "./candidates";
import { buildErrorReview } from "./error-review";
import { 字形渲染器 } from "./render";
import { UNICODE_DIR } from "./unicode-pdf";

const ROOT = resolve(import.meta.dir, "../..");
const DATA = join(ROOT, "packages/hanzi-chai/src/data");
const read = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8"));
const write = (p: string, data: unknown) =>
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
type Choice = 候选 & { image: string; svg: string };
type Task = {
  id: string;
  unicode: number;
  character: string;
  source: string;
  referenceSource: string;
  target: { image: string; rowImage: string };
  reference: { image: string };
  candidates: Choice[];
  sourceCandidates?: Choice[];
};
type Batch = {
  batchId: string;
  tasks: Task[];
  selection: {
    eligibleCount: number;
    selectedCodepoints: string[];
    selectedCount: number;
    seed: string;
  };
  training: { excludedCharacters: number[] };
};
type Shape = { signature: string; render: string };
type Truth = Shape & { changed: boolean };
type BlindDecision = { taskId: string; choice: string | null; reason: string };
type BlindTask = {
  taskId: string;
  unicode: number;
  source: string;
  targetImage: string;
  referenceImage: string;
  candidates: { key: string; image: string }[];
};

/** 严格复现 GlyphRecommendation 的逐引用全局频数投票；同票取样本中先出现者。 */
function 原始统计推断(
  characters: 字符数据[],
  glyphs: Map<number, 基本字形数据>,
  excluded: Set<number>,
) {
  const votes = new Map<string, Map<number, number>>();
  for (const c of characters) {
    if (!在人工范围(c.unicode) || excluded.has(c.unicode)) continue;
    const association = c.glyphs.find((g) => g.sources.includes("G"));
    const base = association && glyphs.get(association.id);
    if (base?.type !== "compound") continue;
    const firstPositions = new Map<number, number>();
    base.references.forEach((r, i) => {
      if (!firstPositions.has(r.id)) firstPositions.set(r.id, i);
    });
    for (const targetAssociation of c.glyphs) {
      const target = glyphs.get(targetAssociation.id);
      if (target?.type !== "compound") continue;
      for (const source of targetAssociation.sources) {
        if (source === "G") continue;
        for (const [id, position] of firstPositions) {
          const to = target.references[position]?.id;
          if (to === undefined) continue;
          const key = `${source}:${id}`;
          if (!votes.has(key)) votes.set(key, new Map());
          const counter = votes.get(key)!;
          counter.set(to, (counter.get(to) ?? 0) + 1);
        }
      }
    }
  }
  return (base: 基本字形数据, source: string) => {
    if (base.type !== "compound") throw new Error("回测参考字形须为复合体");
    let probability: number | null = 1;
    const evidence = base.references.map((r) => {
      const counter =
        votes.get(`${source}:${r.id}`) ?? new Map<number, number>();
      let selected = r.id,
        maximum = 0,
        total = 0;
      for (const [id, count] of counter) {
        total += count;
        if (count > maximum) {
          maximum = count;
          selected = id;
        }
      }
      if (total === 0) probability = null;
      else if (probability !== null) probability *= maximum / total;
      return { from: r.id, to: selected, count: maximum, total };
    });
    const { name, gf0014_id, gf3001_id, ...rest } = base;
    const glyph: 基本字形数据 = {
      ...rest,
      id: 0,
      references: base.references.map((r, i) => ({
        ...r,
        id: evidence[i]!.to,
      })),
    };
    return { glyph, probability, evidence };
  };
}

function prepare(out: string, seed: string) {
  if (existsSync(join(out, "tasks.json")))
    throw new Error("回测批次已存在，请换一个 --out");
  mkdirSync(out, { recursive: true });
  const sources = [
    ...new Set(
      [
        ...读取来源(
          readFileSync(join(UNICODE_DIR, "Unihan_IRGSources.txt"), "utf8"),
        ).values(),
      ].flatMap((m) => [...m.keys()]),
    ),
  ].filter((s) => s !== "G");
  const generated = Bun.spawnSync(
    [
      "bun",
      join(import.meta.dir, "cli.ts"),
      "generate",
      "--source-local",
      "--holdout",
      "--from",
      "4E00",
      "--to",
      "68FF",
      "--limit",
      "100",
      "--seed",
      seed,
      "--sources",
      sources.join(","),
      "--out",
      out,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (generated.exitCode !== 0) throw new Error("生成回测批次失败");
  const batch = read<Batch>(join(out, "tasks.json"));
  const characters = read<字符数据[]>(join(DATA, "characters.json"));
  const characterMap = new Map(characters.map((c) => [c.unicode, c]));
  const glyphs = new Map(
    read<基本字形数据[]>(join(DATA, "glyphs.json")).map((g) => [g.id, g]),
  );
  const renderer = new 字形渲染器(glyphs);
  const infer = 原始统计推断(
    characters,
    glyphs,
    new Set(batch.training.excludedCharacters),
  );
  const blind = join(out, "blind");
  for (const dir of ["assets", "panels", "assignments", "results"])
    mkdirSync(join(blind, dir), { recursive: true });
  const baselines: Record<
    string,
    ReturnType<ReturnType<typeof 原始统计推断>>
  > = {};
  const truth: Record<string, Truth> = {};
  const choiceMap: Record<
    string,
    Record<string, { signature: string; render: string; originalKey: string }>
  > = {};
  const blindTasks: BlindTask[] = [];
  const scoringRenders: Record<string, { baseline: Shape; prototype: Shape }> =
    {};
  for (const task of batch.tasks) {
    if (task.source === "G") throw new Error("回测不应包含 G 源任务");
    const character = characterMap.get(task.unicode)!;
    const baseAssociation = character.glyphs.find((g) =>
      g.sources.includes("G"),
    );
    const base = baseAssociation && glyphs.get(baseAssociation.id);
    if (!base) throw new Error(`${task.id} 缺少 G 源参考`);
    const goldAssociation = character.glyphs.find((g) =>
      g.sources.includes(task.source),
    );
    const gold = goldAssociation && glyphs.get(goldAssociation.id);
    if (gold)
      truth[task.id] = {
        signature: 字形签名(gold),
        render: hash(renderer.渲染(gold)),
        changed: 字形签名(gold) !== 字形签名(base),
      };
    const baseline = infer(base, task.source);
    baselines[task.id] = baseline;
    const shape = (glyph: 基本字形数据): Shape => ({
      signature: 字形签名(glyph),
      render: hash(renderer.渲染(glyph)),
    });
    scoringRenders[task.id] = {
      baseline: shape(baseline.glyph),
      prototype: shape((task.sourceCandidates ?? task.candidates)[0]!.glyph),
    };
    const options = task.candidates.map((c) => ({
      glyph: c.glyph,
      image: join(out, c.image),
      originalKey: c.key,
    }));
    if (!options.some((c) => 字形签名(c.glyph) === 字形签名(baseline.glyph))) {
      const svg = renderer.渲染(baseline.glyph),
        image = join(out, "renders", `${task.id}-statistical.png`);
      writeFileSync(
        image,
        new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng(),
      );
      options.push({
        glyph: baseline.glyph,
        image,
        originalKey: "statistical-baseline",
      });
    }
    // 仅用种子打乱展示顺序；不让 agent 看见统计排名、频数、字形 ID 或答案。
    options.sort((a, b) =>
      hash(`${seed}:choices:${task.id}:${a.originalKey}`).localeCompare(
        hash(`${seed}:choices:${task.id}:${b.originalKey}`),
      ),
    );
    const targetImage = join(blind, "assets", `${task.id}-target.png`);
    const referenceImage = join(
      blind,
      "assets",
      `${task.unicode.toString(16).toUpperCase()}-G-reference.png`,
    );
    copyFileSync(join(out, task.target.image), targetImage);
    copyFileSync(join(out, task.reference.image), referenceImage);
    const candidates = options.map((option, i) => {
      const key = String.fromCharCode(65 + i),
        image = join(blind, "assets", `${task.id}-choice-${key}.png`);
      copyFileSync(option.image, image);
      choiceMap[task.id] ??= {};
      choiceMap[task.id]![key] = {
        signature: 字形签名(option.glyph),
        render: hash(renderer.渲染(option.glyph)),
        originalKey: option.originalKey,
      };
      return { key, image };
    });
    blindTasks.push({
      taskId: task.id,
      unicode: task.unicode,
      source: task.source,
      targetImage,
      referenceImage,
      candidates,
    });
  }
  write(join(out, "scoring-renders.json"), scoringRenders);
  write(join(out, "truth-private.json"), truth);
  write(join(out, "baseline-private.json"), baselines);
  write(join(out, "choices-private.json"), choiceMap);
  const charactersForAgent = writeBlind(out, blindTasks);
  write(join(out, "experiment.json"), {
    seed,
    sampleSize: 100,
    poolSize: batch.selection.eligibleCount,
    sampleMethod: "crypto-random seed + SHA256 ordering without replacement",
    evaluation:
      "non-G source; whole 100-character exclusion from training; structural signature or identical rendered SVG paths; abstention counts as incorrect",
    baseline:
      "GlyphRecommendation original global per-reference frequency argmax, independent product; zero samples retain original reference; preserve layout/stroke blocks",
    secondaryBaseline:
      "prototype first-ranked candidate (uncalibrated ranking score), frozen before agent grading",
    candidatePolicy:
      "prototype candidates plus statistical-baseline combination, then blind shuffle",
    sourceTasks: blindTasks.length,
    selectedCodepoints: batch.selection.selectedCodepoints,
    blindDirectory: blind,
  });
  console.log(
    JSON.stringify(
      {
        out,
        seed,
        characters: charactersForAgent.length,
        tasks: blindTasks.length,
        shards: [0, 1, 2].map(
          (s) => charactersForAgent.filter((_, i) => i % 3 === s).length,
        ),
      },
      null,
      2,
    ),
  );
}

function writeBlind(out: string, blindTasks: BlindTask[]) {
  const blind = join(out, "blind");
  write(join(blind, "tasks.json"), blindTasks);
  copyFileSync(
    join(import.meta.dir, "agent-task", "AGENTS.md"),
    join(blind, "AGENTS.md"),
  );
  const font = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ].find(existsSync);
  const png = (path: string) =>
    `data:image/png;base64,${readFileSync(path).toString("base64")}`;
  const byCharacter = new Map<number, BlindTask[]>();
  for (const task of blindTasks) {
    if (!byCharacter.has(task.unicode)) byCharacter.set(task.unicode, []);
    byCharacter.get(task.unicode)!.push(task);
  }
  const charactersForAgent: {
    unicode: number;
    codepoint: string;
    panel: string;
    tasks: BlindTask[];
  }[] = [];
  for (const [unicode, tasks] of byCharacter) {
    const codepoint = unicode.toString(16).toUpperCase();
    const maximum = Math.max(...tasks.map((t) => t.candidates.length));
    const columns = maximum;
    const width = 260 + 180 * columns;
    const height =
      220 +
      tasks.reduce(
        (n, t) =>
          n + Math.max(1, Math.ceil(t.candidates.length / columns)) * 200,
        0,
      );
    const elements = [
      `<rect width="100%" height="100%" fill="white"/>`,
      `<text x="15" y="28" font-size="22">U+${codepoint} | G reference</text>`,
      `<image x="25" y="45" width="150" height="150" href="${png(tasks[0]!.referenceImage)}"/>`,
    ];
    let offset = 220;
    tasks.forEach((task) => {
      const y = offset;
      offset += Math.max(1, Math.ceil(task.candidates.length / columns)) * 200;
      elements.push(
        `<path d="M0 ${y - 15}H${width}" stroke="#ccc"/>`,
        `<text x="15" y="${y + 3}" font-size="18">${task.taskId} TARGET</text>`,
        `<image x="25" y="${y + 15}" width="160" height="160" href="${png(task.targetImage)}"/>`,
      );
      task.candidates.forEach((c, j) => {
        const x = 225 + 180 * (j % columns),
          cy = y + 200 * Math.floor(j / columns);
        elements.push(
          `<text x="${x + 20}" y="${cy + 3}" font-size="20">${c.key}</text>`,
          `<image x="${x}" y="${cy + 15}" width="160" height="160" href="${png(c.image)}"/>`,
        );
      });
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">${elements.join("")}</svg>`;
    const panel = join(blind, "panels", `${codepoint}.png`);
    writeFileSync(
      panel,
      new Resvg(svg, {
        font: {
          loadSystemFonts: !font,
          fontFiles: font ? [font] : [],
          defaultFontFamily: "Arial",
        },
      })
        .render()
        .asPng(),
    );
    charactersForAgent.push({ unicode, codepoint, panel, tasks });
  }
  for (let shard = 0; shard < 3; shard++)
    write(join(blind, "assignments", `shard-${shard + 1}.json`), {
      shard: shard + 1,
      characters: charactersForAgent.filter((_, i) => i % 3 === shard),
    });
  return charactersForAgent;
}

function score(out: string, verifyOnly = false) {
  const batch = read<Batch>(join(out, "tasks.json"));
  const truth = read<Record<string, Truth>>(join(out, "truth-private.json"));
  const baselines = read<Record<string, { glyph: 基本字形数据 }>>(
    join(out, "baseline-private.json"),
  );
  const choices = read<
    Record<string, Record<string, { signature: string; render: string }>>
  >(join(out, "choices-private.json"));
  // 评分只消费准备时冻结的渲染哈希，不依赖后续源码或本地字库。
  const frozen = read<
    Record<
      string,
      {
        baseline: { signature: string; render: string };
        prototype: { signature: string; render: string };
      }
    >
  >(join(out, "scoring-renders.json"));
  const submissionPath = join(out, "agent-submissions.json");
  const submissions = [1, 2, 3].map((shard) => {
    const path = join(out, "blind/results", `shard-${shard}.json`);
    return { path, sha256: hash(readFileSync(path, "utf8")) };
  });
  if (existsSync(submissionPath)) {
    const saved = read<{ submissions: typeof submissions }>(submissionPath);
    if (
      saved.submissions.length !== submissions.length ||
      submissions.some(
        (item, i) => item.sha256 !== saved.submissions[i]?.sha256,
      )
    )
      throw new Error("已冻结的 agent 提交发生变化");
  } else if (verifyOnly) {
    throw new Error("缺少冻结的 agent 提交哈希");
  }
  const decisions = new Map<string, BlindDecision>();
  for (let shard = 1; shard <= 3; shard++) {
    const rows = read<{ decisions: BlindDecision[] }>(
      join(out, "blind", "results", `shard-${shard}.json`),
    ).decisions;
    const assignment = read<{ characters: { tasks: { taskId: string }[] }[] }>(
      join(out, "blind", "assignments", `shard-${shard}.json`),
    );
    const assigned = new Set(
      assignment.characters.flatMap((c) => c.tasks.map((t) => t.taskId)),
    );
    if (
      rows.length !== assigned.size ||
      rows.some((row) => !assigned.has(row.taskId))
    )
      throw new Error(`分片 ${shard} 未完整覆盖分配任务`);
    for (const row of rows) {
      if (decisions.has(row.taskId)) throw new Error(`重复判定 ${row.taskId}`);
      decisions.set(row.taskId, row);
    }
  }
  const matches = (
    signature: string | undefined,
    render: string | undefined,
    t: Truth,
  ) => signature === t.signature || render === t.render;
  const rows = batch.tasks.map((task) => {
    const decision = decisions.get(task.id);
    if (!decision?.reason?.trim()) throw new Error(`缺少实际核验 ${task.id}`);
    const choice =
      decision.choice === null ? null : choices[task.id]?.[decision.choice];
    if (decision.choice !== null && !choice)
      throw new Error(`无效候选 ${task.id}:${decision.choice}`);
    const t = truth[task.id],
      baseline = baselines[task.id]!.glyph;
    const prototype = (task.sourceCandidates ?? task.candidates)[0]?.glyph;
    if (
      !frozen[task.id] ||
      frozen[task.id]!.baseline.signature !== 字形签名(baseline) ||
      !prototype ||
      frozen[task.id]!.prototype.signature !== 字形签名(prototype)
    )
      throw new Error(`冻结评分渲染与候选不符：${task.id}`);
    return {
      taskId: task.id,
      source: task.source,
      changed: t?.changed ?? null,
      scorable: Boolean(t),
      statisticalCorrect: t
        ? matches(字形签名(baseline), frozen[task.id]!.baseline.render, t)
        : null,
      agentCorrect: t ? matches(choice?.signature, choice?.render, t) : null,
      prototypeCorrect: t
        ? matches(
            prototype && 字形签名(prototype),
            prototype && frozen[task.id]!.prototype.render,
            t,
          )
        : null,
      statisticalStrict: t ? 字形签名(baseline) === t.signature : null,
      agentStrict: t ? choice?.signature === t.signature : null,
      candidateCovered: t
        ? Object.values(choices[task.id]!).some((c) =>
            matches(c.signature, c.render, t),
          )
        : null,
      agentChoice: decision.choice,
      reason: decision.reason,
    };
  });
  if (decisions.size !== rows.length)
    throw new Error("结果包含本批次之外的任务");
  const summarize = (subset: typeof rows) => {
    const eligible = subset.filter((r) => r.scorable),
      n = eligible.length;
    const count = (
      key:
        | "statisticalCorrect"
        | "agentCorrect"
        | "candidateCovered"
        | "prototypeCorrect",
    ) => eligible.filter((r) => r[key]).length;
    return {
      total: n,
      statisticalCorrect: count("statisticalCorrect"),
      statisticalAccuracy: count("statisticalCorrect") / n,
      prototypeCorrect: count("prototypeCorrect"),
      prototypeAccuracy: count("prototypeCorrect") / n,
      agentCorrect: count("agentCorrect"),
      agentAccuracy: count("agentCorrect") / n,
      candidateCovered: count("candidateCovered"),
      candidateCoverage: count("candidateCovered") / n,
      agentAbstentions: eligible.filter((r) => r.agentChoice === null).length,
      statisticalStrict: eligible.filter((r) => r.statisticalStrict).length,
      agentStrict: eligible.filter((r) => r.agentStrict).length,
      falseRejections: eligible.filter(
        (r) => r.agentChoice === null && r.candidateCovered,
      ).length,
      correctRejections: eligible.filter(
        (r) => r.agentChoice === null && !r.candidateCovered,
      ).length,
    };
  };
  const result = {
    experiment: read(join(out, "experiment.json")),
    overall: summarize(rows),
    changed: summarize(rows.filter((r) => r.changed)),
    unchanged: summarize(rows.filter((r) => r.changed === false)),
    bySource: Object.fromEntries(
      [...new Set(rows.map((r) => r.source))].map((source) => [
        source,
        summarize(rows.filter((r) => r.source === source)),
      ]),
    ),
    unscored: rows.filter((r) => !r.scorable).map((r) => r.taskId),
    agentFixed: rows
      .filter((r) => r.scorable && !r.statisticalCorrect && r.agentCorrect)
      .map((r) => r.taskId),
    agentRegressed: rows
      .filter((r) => r.scorable && r.statisticalCorrect && !r.agentCorrect)
      .map((r) => r.taskId),
    characters: {
      total: new Set(batch.tasks.map((t) => t.unicode)).size,
      statisticalAllSourcesCorrect: [
        ...new Set(batch.tasks.map((t) => t.unicode)),
      ].filter((cp) =>
        rows
          .filter(
            (r) =>
              r.taskId.startsWith(`${cp.toString(16).toUpperCase()}-`) &&
              r.scorable,
          )
          .every((r) => r.statisticalCorrect),
      ).length,
      agentAllSourcesCorrect: [
        ...new Set(batch.tasks.map((t) => t.unicode)),
      ].filter((cp) =>
        rows
          .filter(
            (r) =>
              r.taskId.startsWith(`${cp.toString(16).toUpperCase()}-`) &&
              r.scorable,
          )
          .every((r) => r.agentCorrect),
      ).length,
    },
  };
  if (verifyOnly) {
    if (
      !isDeepStrictEqual(read(join(out, "evaluation.json")), result) ||
      !isDeepStrictEqual(read(join(out, "evaluation-rows.json")), rows)
    )
      throw new Error("冻结评分结果与重新计算不一致");
    console.log(
      JSON.stringify({ status: "passed", overall: result.overall }, null, 2),
    );
    return;
  }
  if (!existsSync(submissionPath))
    write(submissionPath, { frozenAt: new Date().toISOString(), submissions });
  write(join(out, "evaluation.json"), result);
  write(join(out, "evaluation-rows.json"), rows);
  const errorReview = buildErrorReview(out);
  console.log(
    JSON.stringify(
      {
        overall: result.overall,
        changed: result.changed,
        unchanged: result.unchanged,
        unscored: result.unscored,
        fixed: result.agentFixed.length,
        regressed: result.agentRegressed.length,
        errorReview,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { out: { type: "string" }, seed: { type: "string" } },
  });
  try {
    if (!values.out) throw new Error("必须用 --out 指定独立批次目录");
    const out = resolve(values.out);
    if (positionals[0] === "prepare")
      prepare(out, values.seed ?? randomBytes(16).toString("hex"));
    else if (positionals[0] === "score") score(out);
    else if (positionals[0] === "verify") score(out, true);
    else
      throw new Error(
        "用法：bun scripts/glyph-review/backtest.ts prepare|score|verify --out <目录> [--seed <种子>]",
      );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
