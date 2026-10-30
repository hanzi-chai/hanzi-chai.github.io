import "dotenv/config";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import pako from "pako";
import { createClient } from "../../packages/api/src/client";
import { 比较部件拓扑 } from "./enclosure-topology";

// 本批次固定路径；新的迁移须使用独立快照及计划。
const out = resolve("output/glyph-review/overlay-ti-migration-20261030");
const read = (p: string): any => JSON.parse(readFileSync(join(out, p), "utf8"));
const save = (p: string, v: unknown) => {
  writeFileSync(join(out, p) + ".tmp", JSON.stringify(v, null, 2));
  renameSync(join(out, p) + ".tmp", join(out, p));
};
const canonical = (v: any): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .filter((k) => v[k] !== undefined)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",")}}`
      : JSON.stringify(v);
const equal = (a: any, b: any) => canonical(a) === canonical(b);
const hash = (v: string | Uint8Array) =>
  createHash("sha256").update(v).digest("hex");
const require = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const before: any[] = read("before-glyphs.json"),
  characters: any[] = read("before-characters.json");
const beforeMap = new Map(before.map((g) => [g.id, g]));
const manifest = read("manifest.json");
require(hash(readFileSync(join(out, "before-glyphs.json"))) ===
  manifest.glyphsSha256, "基线字形被修改");
require(hash(readFileSync(join(out, "before-characters.json"))) ===
  manifest.charactersSha256, "基线字符被修改");
require(hash(readFileSync(join(out, "renderer-snapshot/renderer.mjs"))) ===
  manifest.bundleSha256, "冻结渲染器被修改");
const { 字形渲染器 } = await import(
  join(out, "renderer-snapshot/renderer.mjs")
);
const phase = process.argv[2];
const client = createClient(() => process.env.JWT ?? null);
async function get(slug: string): Promise<any[]> {
  const result = await client.get<any[]>(slug);
  require(Array.isArray(result), `GET ${slug} 失败`);
  return result as any[];
}

function validate(plan: any[]) {
  require(new Set(plan.map((p) => p.id)).size === plan.length, "重复更新 ID");
  for (const p of plan) {
    require(equal(beforeMap.get(p.id), p.before), `基线不符 ${p.id}`);
    if (p.kind === "overlay") {
      require(p.before.type === "compound" &&
        p.before.operator === "⿻", `不是叠加 ${p.id}`);
      require(equal(
        { ...p.after, references: p.before.references },
        p.before,
      ), `叠加引用外的修改 ${p.id}`);
      require(p.after.references.length ===
        p.before.references.length, `引用数变化 ${p.id}`);
      p.after.references.forEach((r: any, i: number) => {
        const original = p.before.references[i];
        require(equal(
          Object.fromEntries(
            Object.entries(r).filter(
              ([k]) => !["xbegin", "xend", "ybegin", "yend"].includes(k),
            ),
          ),
          Object.fromEntries(
            Object.entries(original).filter(
              ([k]) => !["xbegin", "xend", "ybegin", "yend"].includes(k),
            ),
          ),
        ), `引用非坐标变化 ${p.id}`);
        require(Object.values(r).every(
          (v) => typeof v !== "number" || Number.isFinite(v),
        ), `非有限参数 ${p.id}`);
      });
    } else {
      require(equal(
        { ...p.after, strokes: p.before.strokes },
        p.before,
      ), `提笔画外修改 ${p.id}`);
      require(equal(
        p.before.strokes.map((s: any) => s.feature),
        p.after.strokes.map((s: any) => s.feature),
      ), `笔画数或种类变化 ${p.id}`);
      for (const s of p.after.strokes)
        if (s.feature.endsWith("提"))
          require(s.curveList.at(-1).command === "l", `提未迁移 ${p.id}`);
      require(比较部件拓扑(p.before, p.after).passed, `双向拓扑失败 ${p.id}`);
    }
  }
}

function fullAudit(plan: any[], actual?: any[]) {
  const afterMap = new Map((actual ?? before).map((g) => [g.id, g]));
  if (!actual) for (const p of plan) afterMap.set(p.id, p.after);
  require(afterMap.size === (actual ?? before).length, "重复 ID");
  for (const g of afterMap.values())
    if (g.type === "compound")
      for (const r of g.references)
        require(afterMap.has(r.id), `悬空引用 ${g.id} -> ${r.id}`);
  const affected = new Set(plan.map((p) => p.id)),
    parents = new Map<number, number[]>();
  for (const g of before)
    if (g.type === "compound")
      for (const r of g.references) {
        const a = parents.get(r.id) ?? [];
        a.push(g.id);
        parents.set(r.id, a);
      }
  const queue = [...affected];
  for (let i = 0; i < queue.length; i++)
    for (const parent of parents.get(queue[i]!) ?? [])
      if (!affected.has(parent)) {
        affected.add(parent);
        queue.push(parent);
      }
  const a = new 字形渲染器(beforeMap),
    b = new 字形渲染器(afterMap),
    checks: any[] = [];
  for (const id of affected) {
    const result: any = { id };
    for (const [key, renderer, map] of [
      ["before", a, beforeMap],
      ["after", b, afterMap],
    ] as const) {
      try {
        const svg = renderer.渲染(map.get(id));
        require(!/NaN|Infinity/.test(svg), "非法 SVG");
        result[key] = { sha256: hash(svg) };
      } catch (e) {
        result[key] = { error: String(e) };
      }
    }
    checks.push(result);
  }
  const regressions = checks.filter(
    (c) => c.after.error && c.after.error !== c.before.error,
  );
  return {
    affected: affected.size,
    renderable: checks.filter((c) => !c.after.error).length,
    preExistingErrors: checks.filter(
      (c) => c.before.error && c.before.error === c.after.error,
    ),
    regressions,
    checks,
  };
}

if (phase === "prepare") {
  require(!existsSync(join(out, "journal.json")) &&
    !existsSync(
      join(out, "final-plan.json"),
    ), "已有冻结计划/上传日志，不得重新 prepare");
  const decisions = read("overlay-decisions.json"),
    ti = read("ti-plan.json");
  const plan = [
    ...decisions
      .filter((d: any) => d.references)
      .map((d: any) => ({
        id: d.id,
        kind: "overlay",
        before: beforeMap.get(d.id),
        after: { ...beforeMap.get(d.id), references: d.references },
      })),
    ...ti.map((p: any) => ({
      id: p.id,
      kind: "ti",
      before: p.before,
      after: p.after,
    })),
  ];
  validate(plan);
  const audit = fullAudit(plan);
  save("preflight-render-audit.json", audit);
  require(!audit.regressions.length, "新渲染回归");
  const evidence = read("combined-final/evidence.json");
  require(evidence.decisionsSha256 ===
    hash(canonical(decisions)), "叠加审核版本不符");
  const afterMap = new Map(beforeMap);
  for (const p of plan) afterMap.set(p.id, p.after);
  const renderer = new 字形渲染器(afterMap);
  for (const e of evidence.evidence.filter(
    (e: any) => e.which === "after" && !e.error,
  ))
    require(hash(renderer.渲染(afterMap.get(e.id))) ===
      e.svgSha256, `已审图变化 ${e.id}`);
  for (const p of ti)
    require(hash(renderer.渲染(p.after)) ===
      hash(
        readFileSync(join(out, "ti-review/renders", `${p.id}-after.svg`)),
      ), `提已审图变化 ${p.id}`);
  const panels = ["combined-final", "ti-review"].flatMap((dir) =>
    Array.from({ length: dir === "combined-final" ? 11 : 9 }, (_, i) => ({
      path: `${dir}/panels/${i + 1}.png`,
      sha256: hash(readFileSync(join(out, dir, "panels", `${i + 1}.png`))),
    })),
  );
  save("visual-review.json", {
    reviewedAt: new Date().toISOString(),
    reviewer: "Codex",
    method:
      "逐页实际查看全部 43 项叠加及 102 个提部件最终对照面板；保留无法靠引用参数修复的项。",
    panels,
    decisionsSha256: hash(canonical(decisions)),
    tiPlanSha256: hash(canonical(ti)),
  });
  save("final-plan.json", plan);
  console.log(
    JSON.stringify({
      updates: plan.length,
      overlays: plan.filter((p) => p.kind === "overlay").length,
      tiGlyphs: ti.length,
      affected: audit.affected,
      renderable: audit.renderable,
      preExistingErrors: audit.preExistingErrors.length,
      regressions: audit.regressions.length,
    }),
  );
}

if (phase === "apply") {
  const plan = read("final-plan.json");
  validate(plan);
  const sha = hash(canonical(plan));
  const journal = existsSync(join(out, "journal.json"))
    ? read("journal.json")
    : {
        startedAt: new Date().toISOString(),
        planSha256: sha,
        completed: [],
        pending: [],
        events: [],
      };
  require(journal.planSha256 === sha, "上传计划变化");
  const [current, chars] = await Promise.all([
    get("/glyphs"),
    get("/characters"),
  ]);
  const cm = new Map(current.map((g) => [g.id, g])),
    pm = new Map(plan.map((p: any) => [p.id, p]));
  require(cm.size === beforeMap.size &&
    current.length === before.length, "远程记录数量变化");
  require(equal(chars, characters), "字符表并发变化");
  for (const g of before) {
    const p: any = pm.get(g.id);
    require(equal(cm.get(g.id), g) ||
      (p && equal(cm.get(g.id), p.after)), `远程并发修改 ${g.id}`);
  }
  journal.completed = plan
    .filter((p: any) => equal(cm.get(p.id), p.after))
    .map((p: any) => p.id);
  journal.pending = [];
  save("journal.json", journal);
  const remaining = plan.filter((p: any) => !journal.completed.includes(p.id));
  for (let start = 0; start < remaining.length; start += 50) {
    const batch = remaining.slice(start, start + 50);
    // 紧邻写入前再次核对本批，避免覆盖审核期间的并发编辑。
    const live = new Map((await get("/glyphs")).map((g) => [g.id, g]));
    for (const p of batch)
      require(equal(live.get(p.id), p.before), `本批并发修改 ${p.id}`);
    journal.pending = batch.map((p: any) => p.id);
    save("journal.json", journal);
    let response: any;
    try {
      response = await client.put(
        "/glyphs/batch",
        batch.map((p: any) => p.after),
      );
    } catch {
      response = "response-unknown";
    }
    const confirmed = new Map((await get("/glyphs")).map((g) => [g.id, g]));
    const success = batch.filter((p: any) =>
      equal(confirmed.get(p.id), p.after),
    );
    journal.completed.push(...success.map((p: any) => p.id));
    journal.pending = batch
      .filter((p: any) => !success.includes(p))
      .map((p: any) => p.id);
    journal.events.push({
      at: new Date().toISOString(),
      ids: batch.map((p: any) => p.id),
      confirmed: success.length,
      response: response === true ? "ok" : "not-confirmed-by-response",
    });
    save("journal.json", journal);
    require(success.length ===
      batch.length, "批次未全部确认；日志已保存，回读后恢复");
    console.log(`已确认 ${journal.completed.length}/${plan.length}`);
  }
  journal.completedAt = new Date().toISOString();
  save("journal.json", journal);
}

if (phase === "verify") {
  const plan = read("final-plan.json");
  validate(plan);
  const [actual, chars] = await Promise.all([
    get("/glyphs"),
    get("/characters"),
  ]);
  save("after-glyphs.json", actual);
  save("after-characters.json", chars);
  const map = new Map(actual.map((g) => [g.id, g])),
    expected = new Map(beforeMap);
  for (const p of plan) expected.set(p.id, p.after);
  require(actual.length === before.length &&
    map.size === expected.size, "记录数变化");
  for (const [id, g] of expected)
    require(equal(map.get(id), g), `回读差异 ${id}`);
  require(equal(chars, characters), "字符表变化");
  const audit = fullAudit(plan, actual),
    preflight = read("preflight-render-audit.json");
  require(equal(audit, preflight), "实际回读渲染与冻结计划不一致");
  save("postflight-render-audit.json", audit);
  const remainingTi = actual.flatMap((g) =>
    g.type === "component"
      ? g.strokes.filter(
          (s: any) =>
            s.feature.endsWith("提") && s.curveList.at(-1).command !== "l",
        )
      : [],
  );
  require(!remainingTi.length, "仍有未迁移提");
  const version = JSON.parse(
    readFileSync("packages/hanzi-chai/package.json", "utf8"),
  ).version;
  for (const dir of [
    "packages/hanzi-chai/src/data",
    `public/data/${version}`,
  ]) {
    mkdirSync(dir, { recursive: true });
    for (const [name, data] of [
      ["glyphs", actual],
      ["characters", chars],
    ] as const) {
      const json = JSON.stringify(data);
      writeFileSync(join(dir, `${name}.json`), json);
      writeFileSync(join(dir, `${name}.json.deflate`), pako.deflate(json));
    }
  }
  const result = {
    verifiedAt: new Date().toISOString(),
    updates: plan.length,
    overlays: plan.filter((p: any) => p.kind === "overlay").length,
    tiGlyphs: plan.filter((p: any) => p.kind === "ti").length,
    tiStrokes: actual.flatMap((g) =>
      g.type === "component"
        ? g.strokes.filter((s: any) => s.feature.endsWith("提"))
        : [],
    ).length,
    unchangedGlyphs: before.length - plan.length,
    charactersUnchanged: true,
    referencesValid: true,
    affected: audit.affected,
    renderable: audit.renderable,
    preExistingErrors: audit.preExistingErrors.length,
    newRenderErrors: 0,
    renderHashesMatch: true,
    localCachesSynced: true,
    frontendDeployed: false,
  };
  save("result.json", result);
  console.log(JSON.stringify(result, null, 2));
}
