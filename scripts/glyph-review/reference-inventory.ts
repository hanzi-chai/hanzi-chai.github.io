import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
const { values } = parseArgs({ options: { out: { type: "string" } } });
const out = resolve(values.out ?? "output/glyph-reference-inventory-20261031");
type Glyph = {
  id: number;
  type: string;
  name?: string;
  operator?: string;
  references?: { id: number }[];
  strokes?: unknown[];
};
type Character = {
  unicode: number;
  glyphs: { id: number; sources: string[] }[];
};
const read = (p: string) => JSON.parse(readFileSync(join(out, p), "utf8"));
const write = (p: string, x: unknown) =>
  writeFileSync(join(out, p), JSON.stringify(x, null, 2) + "\n");
const glyphs: Glyph[] = read("snapshot/glyphs.json"),
  characters: Character[] = read("snapshot/characters.json");
const gm = new Map(glyphs.map((g) => [g.id, g]));
if (gm.size !== glyphs.length) throw Error("Duplicate glyph IDs");
if (new Set(characters.map((c) => c.unicode)).size !== characters.length)
  throw Error("Duplicate character codepoints");
const children = new Map<number, number[]>(),
  parents = new Map<number, Set<number>>();
for (const g of glyphs) {
  const rr = (g.references ?? []).map((r) => r.id);
  children.set(g.id, rr);
  for (const id of rr) {
    if (!gm.has(id)) throw Error(`Missing glyph ${g.id} -> ${id}`);
    if (!parents.has(id)) parents.set(id, new Set());
    parents.get(id)!.add(g.id);
  }
}
// True child-before-parent order; distinct children for Kahn indegree, repeated slots retained for frequency.
const pending = new Map(
  glyphs.map((g) => [g.id, new Set(children.get(g.id)).size]),
);
const childFirst: number[] = glyphs
  .filter((g) => pending.get(g.id) === 0)
  .map((g) => g.id);
for (let i = 0; i < childFirst.length; i++)
  for (const p of parents.get(childFirst[i]!) ?? []) {
    pending.set(p, pending.get(p)! - 1);
    if (pending.get(p) === 0) childFirst.push(p);
  }
if (childFirst.length !== glyphs.length)
  throw Error(`Cycle: ${glyphs.length - childFirst.length} nodes blocked`);
const heights = new Map<number, number>();
for (const id of childFirst)
  heights.set(
    id,
    Math.max(-1, ...children.get(id)!.map((c) => heights.get(c)!)) + 1,
  );
const ranges = [["basic", 0x4e00, 0x9fff]] as const;
const basic = (cp: number) => cp >= 0x4e00 && cp <= 0x9fff;
function analyze(name: string, predicate: (cp: number) => boolean) {
  mkdirSync(join(out, name), { recursive: true });
  const cs = characters.filter((c) => predicate(c.unicode));
  const roots = new Set<number>(),
    bindingWeight = new Map<number, number>(),
    bindings = new Map<
      number,
      { unicode: number; character: string; sources: string[] }[]
    >();
  for (const c of cs) {
    const seen = new Set<number>();
    for (const b of c.glyphs) {
      if (!gm.has(b.id))
        throw Error(`Missing binding U+${c.unicode.toString(16)} -> ${b.id}`);
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      roots.add(b.id);
      bindingWeight.set(b.id, (bindingWeight.get(b.id) ?? 0) + 1);
      if (!bindings.has(b.id)) bindings.set(b.id, []);
      bindings.get(b.id)!.push({
        unicode: c.unicode,
        character: String.fromCodePoint(c.unicode),
        sources: b.sources,
      });
    }
  }
  const freq = new Map<number, number>(),
    bindingFreq = new Map<number, number>(),
    reachable = new Set(roots);
  for (const id of [...childFirst].reverse()) {
    const active = (freq.get(id) ?? 0) + Number(roots.has(id)),
      activeB = (bindingFreq.get(id) ?? 0) + (bindingWeight.get(id) ?? 0);
    if (!reachable.has(id)) continue;
    for (const c of children.get(id)!) {
      reachable.add(c);
      freq.set(c, (freq.get(c) ?? 0) + active);
      bindingFreq.set(c, (bindingFreq.get(c) ?? 0) + activeB);
    }
  }
  const sorted = [...reachable].sort(
    (a, b) =>
      (freq.get(b) ?? 0) - (freq.get(a) ?? 0) ||
      heights.get(a)! - heights.get(b)! ||
      a - b,
  );
  const rank = new Map(sorted.map((id, i) => [id, i + 1]));
  let equalEdges = 0,
    edgeSlots = 0;
  for (const p of reachable)
    for (const c of children.get(p)!) {
      edgeSlots++;
      if ((freq.get(c) ?? 0) < (freq.get(p) ?? 0))
        throw Error("Frequency monotonicity failed");
      if (rank.get(c)! >= rank.get(p)!)
        throw Error("Dependency ordering failed");
      if (freq.get(c) === freq.get(p)) equalEdges++;
    }
  const rows = sorted.map((id, i) => {
    const g = gm.get(id)!,
      bb = bindings.get(id) ?? [];
    return {
      rank: i + 1,
      glyphId: id,
      type: g.type,
      operator: g.operator ?? "",
      name: g.name ?? "",
      recursiveReferences: freq.get(id) ?? 0,
      bindingWeightedReferences: bindingFreq.get(id) ?? 0,
      directParentGlyphs: [...(parents.get(id) ?? [])].filter((p) =>
        reachable.has(p),
      ).length,
      dependencyHeight: heights.get(id),
      directBoundCharacters: bb.length,
      bindingExamples: bb.slice(0, 12),
      children: children.get(id),
    };
  });
  const nonzero = rows.filter((r) => r.recursiveReferences > 0),
    totalReferences = nonzero.reduce((s, r) => s + r.recursiveReferences, 0);
  function cut(label: string, subset: typeof rows) {
    const ss = new Set(subset.map((x) => x.glyphId));
    let violations = 0;
    for (const p of ss)
      for (const c of children.get(p)!) if (!ss.has(c)) violations++;
    if (violations) throw Error("Cut is not dependency-closed");
    const affected = new Map<number, boolean>();
    for (const id of childFirst)
      affected.set(
        id,
        children.get(id)!.some((c) => ss.has(c) || affected.get(c)),
      );
    const covered = cs.filter((c) =>
      c.glyphs.some((g) => affected.get(g.id)),
    ).length;
    return {
      label,
      glyphs: subset.length,
      components: subset.filter((x) => x.type === "component").length,
      compounds: subset.filter((x) => x.type === "compound").length,
      last: subset.at(-1) ?? null,
      coveredRecursiveOccurrences: subset.reduce(
        (s, r) => s + r.recursiveReferences,
        0,
      ),
      occurrenceCoverage:
        subset.reduce((s, r) => s + r.recursiveReferences, 0) / totalReferences,
      charactersWithSelectedDescendant: covered,
      dependencyClosureViolations: violations,
    };
  }
  const top1000 = nonzero.slice(0, 1000),
    boundary = top1000.at(-1)!.recursiveReferences;
  const summary = {
    scope: name,
    characters: cs.length,
    charactersWithoutGlyph: cs.filter((c) => c.glyphs.length === 0).length,
    characterGlyphBindings: [...bindingWeight.values()].reduce(
      (s, n) => s + n,
      0,
    ),
    uniqueTopLevelGlyphs: roots.size,
    reachableGlyphs: reachable.size,
    nonzeroReferencedGlyphs: nonzero.length,
    zeroReferenceGlyphs: rows.length - nonzero.length,
    nonzeroByType: {
      component: nonzero.filter((r) => r.type === "component").length,
      compound: nonzero.filter((r) => r.type === "compound").length,
    },
    recursiveReferenceOccurrences: totalReferences,
    referenceSlots: edgeSlots,
    equalFrequencyDependencySlots: equalEdges,
    topologicalOrderVerified: true,
    cutoffs: {
      top1000: cut("前 1000 项", top1000),
      atLeast10: cut(
        "引用次数 ≥ 10",
        nonzero.filter((r) => r.recursiveReferences >= 10),
      ),
      moreThan10: cut(
        "引用次数 > 10",
        nonzero.filter((r) => r.recursiveReferences > 10),
      ),
    },
    top1000Ties: {
      frequency: boundary,
      strictlyAbove: nonzero.filter((r) => r.recursiveReferences > boundary)
        .length,
      atBoundary: nonzero.filter((r) => r.recursiveReferences === boundary)
        .length,
      includeAllTies: nonzero.filter((r) => r.recursiveReferences >= boundary)
        .length,
    },
    histogram: Object.fromEntries(
      [...new Set(rows.map((r) => r.recursiveReferences))]
        .sort((a, b) => b - a)
        .map((n) => [
          n,
          rows.filter((r) => r.recursiveReferences === n).length,
        ]),
    ),
    rank995to1005: rows.slice(994, 1005),
    top20: rows.slice(0, 20),
  };
  write(name + "/summary.json", summary);
  write(name + "/ranking.json", rows);
  const tsv =
    [
      [
        "rank",
        "glyph_id",
        "type",
        "operator",
        "name",
        "recursive_references",
        "binding_weighted_references",
        "direct_parent_glyphs",
        "dependency_height",
        "bound_characters",
        "examples",
        "children",
      ].join("\t"),
      ...rows.map((r) =>
        [
          r.rank,
          r.glyphId,
          r.type,
          r.operator,
          r.name,
          r.recursiveReferences,
          r.bindingWeightedReferences,
          r.directParentGlyphs,
          r.dependencyHeight,
          r.directBoundCharacters,
          r.bindingExamples.map((x) => x.character).join(""),
          r.children!.join(","),
        ].join("\t"),
      ),
    ].join("\n") + "\n";
  writeFileSync(join(out, name, "ranking.tsv"), tsv);
  for (const [label, subset] of [
    ["top-1000", top1000],
    ["at-least-10", nonzero.filter((r) => r.recursiveReferences >= 10)],
    ["more-than-10", nonzero.filter((r) => r.recursiveReferences > 10)],
  ] as const)
    write(name + "/" + label + ".json", subset);
  return summary;
}
const results = [analyze("basic", basic)];
write("summary.json", {
  method:
    "Distinct directly bound glyph IDs are expansion roots; root occurrences excluded; each recursive path/slot counted, duplicate source tags not weighted. Descending frequency, then ascending dependency height, then glyph ID. bindingWeightedReferences separately counts each character × glyph binding root.",
  scopeRanges: ranges,
  databaseGlyphRecords: glyphs.length,
  databaseCharacterRecords: characters.length,
  globalGraphAcyclic: true,
  globalReferencesResolved: true,
  scopes: results,
});
const manifestPath = join(out, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.analysisScript = {
  path: "scripts/glyph-review/reference-inventory.ts",
  sha256: createHash("sha256")
    .update(readFileSync(import.meta.filename))
    .digest("hex"),
};
manifest.generatedAt = new Date().toISOString();
write("manifest.json", manifest);
for (const s of results)
  console.log(
    JSON.stringify({
      scope: s.scope,
      characters: s.characters,
      roots: s.uniqueTopLevelGlyphs,
      nonzero: s.nonzeroReferencedGlyphs,
      zero: s.zeroReferenceGlyphs,
      top1000: s.cutoffs.top1000.last,
      atLeast10: s.cutoffs.atLeast10.glyphs,
      moreThan10: s.cutoffs.moreThan10.glyphs,
      ties: s.top1000Ties,
      equalEdges: s.equalFrequencyDependencySlots,
    }),
  );
