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
