import { expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { 读取方案项目, 评估方案项目 } from "../src/index.js";

it("键道按首部、余部取形，独体及单笔起首按笔顺取形，形码不足四码时补末码", () => {
  const 项目 = 读取方案项目(
    fileURLToPath(new URL("../examples/xkjd.yaml", import.meta.url)),
  );
  const 记录 = 评估方案项目(项目);
  const 码对 = new Set(记录.codes.map((x) => `${x.词}\t${x.全码}`));
  // 来自 keytao.single 2026.09.23，覆盖单／双编码字根、短形码及交错笔顺。
  for (const [字, 码] of [
    ["一", "ykvv"],
    ["金", "jbioo"],
    ["贝", "bwaoo"],
    ["丁", "dgvii"],
    ["人", "rnii"],
    ["述", "ejvooa"],
    ["区", "qlvuoa"],
    ["彖", "ttaavu"],
    ["方", "fpovau"],
    ["革", "geviia"],
    ["靴", "xhviiu"],
  ]) {
    expect(码对.has(`${字}\t${码}`), `${字} 应取 ${码}`).toBe(true);
  }
  expect(记录.codes.filter((x) => x.词.length === 1).every((x) => x.全码.length >= 4)).toBe(true);
}, 30_000);
