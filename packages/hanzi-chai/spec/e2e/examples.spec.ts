import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 读取方案项目, 评估方案项目 } from "../../src/index.js";

const 示例目录 = fileURLToPath(
  new URL("../../../../examples/", import.meta.url),
);

describe("示例方案完整运行", () => {
  for (const filename of readdirSync(示例目录)
    .filter((name) => name.endsWith(".yaml"))
    .sort()) {
    it(filename, () => {
      const 项目 = 读取方案项目(path.join(示例目录, filename));
      const 记录 = 评估方案项目(项目);
      expect(记录.analysis.length).toBeGreaterThan(0);
      expect(记录.codes.length).toBeGreaterThan(0);
      expect(记录.codes.some((x) => x.全码.length > 0)).toBe(true);
      expect(记录.metrics.characters_full).toBeDefined();
    }, 30_000);
  }
});
