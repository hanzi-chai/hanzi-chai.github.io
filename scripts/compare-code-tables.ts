export type CodeMap = Map<string, Set<string>>;

export function parseTable(text: string): CodeMap {
  const result: CodeMap = new Map();
  for (const [index, line] of text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .entries()) {
    if (!line) continue;
    const fields = line.split("\t");
    const [char, code] = fields;
    if (
      fields.length !== 2 ||
      !char ||
      [...char].length !== 1 ||
      !code ||
      /\s/.test(code)
    ) {
      throw new Error(`码表第 ${index + 1} 行必须为“单字<TAB>全码”`);
    }
    const codes = result.get(char) ?? new Set<string>();
    codes.add(code);
    result.set(char, codes);
  }
  if (!result.size) throw new Error("参考码表为空");
  return result;
}

/** 按已核实的字、全码对排除参考条目，保留同字的其他编码。 */
export function applyExclusions(reference: CodeMap, text: string) {
  const [header = "", ...lines] = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const columns = header.split("\t");
  const indexes = ["character", "code", "reason"].map((key) => {
    const index = columns.indexOf(key);
    if (index < 0 || columns.lastIndexOf(key) !== index)
      throw new Error(`排除清单必须有唯一的 ${key} 列`);
    return index;
  });
  const seen = new Set<string>();
  const applied: { character: string; code: string; reason: string }[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line) continue;
    const fields = line.split("\t");
    const character = fields[indexes[0]!];
    const code = fields[indexes[1]!];
    const reason = fields[indexes[2]!];
    if (
      fields.length !== columns.length ||
      !character ||
      [...character].length !== 1 ||
      !code ||
      /\s/.test(code) ||
      !reason?.trim()
    )
      throw new Error(`排除清单第 ${index + 2} 行的字、全码或原因无效`);
    const key = `${character}\t${code}`;
    if (seen.has(key)) throw new Error(`排除清单重复码对：${key}`);
    seen.add(key);
    const codes = reference.get(character);
    if (!codes?.delete(code)) continue;
    if (!codes.size) reference.delete(character);
    applied.push({ character, code, reason });
  }
  return { listed_pairs: seen.size, applied_pairs: applied.length, applied };
}

export function compareTables(
  reference: CodeMap,
  generated: CodeMap,
  scope: Set<string>,
) {
  const differences = [];
  let exact = 0;
  let extra = 0;
  let missing = 0;
  let referenceMissing = 0;
  let generatedMissing = 0;
  for (const char of [...scope].sort()) {
    const expected = reference.get(char) ?? new Set<string>();
    const actual = generated.get(char) ?? new Set<string>();
    const added = [...actual].filter((code) => !expected.has(code)).sort();
    const removed = [...expected].filter((code) => !actual.has(code)).sort();
    if (!expected.size) referenceMissing++;
    if (!actual.size) generatedMissing++;
    extra += added.length;
    missing += removed.length;
    if (expected.size && actual.size && !added.length && !removed.length)
      exact++;
    else
      differences.push({
        character: char,
        reference: [...expected].sort(),
        generated: [...actual].sort(),
        extra: added,
        missing: removed,
      });
  }
  return {
    characters: scope.size,
    exact,
    extra,
    missing,
    reference_missing: referenceMissing,
    generated_missing: generatedMissing,
    differences,
  };
}
