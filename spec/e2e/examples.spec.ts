import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 读取方案项目, 评估方案项目 } from "../../src/index.js";

const 示例目录 = fileURLToPath(
  new URL("../../examples/", import.meta.url),
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
      if (filename === "huma.yaml") {
        expect(项目.上下文.配置.data?.character_set).toBe("general");
        expect(项目.上下文.配置.analysis?.fusion).toBeUndefined();
        const 单字码 = new Set(
          记录.codes.map((条目) => `${条目.词}\t${条目.全码}`),
        );
        // 虎码发布表：跨分部取根，以及 general 扩集发现的五字。
        for (const [字, 码] of [
          ["交", "abi"],
          ["免", "wpe"],
          ["制", "qrpd"],
          ["嬿", "blac"],
          ["嬿", "bldc"],
          ["嶲", "vumk"],
          ["楙", "itee"],
          ["楙", "eite"],
          ["耰", "awhh"],
          ["鹍", "ovvx"],
        ]) {
          expect(单字码.has(`${字}\t${码}`)).toBe(true);
        }
      }
      if (filename === "zhangma.yaml") {
        const 单字码 = new Map(
          记录.codes
            .filter((条目) => [...条目.词].length === 1)
            .map((条目) => [条目.词, 条目.全码]),
        );
        // 张码参考表：共用字根、特殊笔顺、准码元与消重补码。
        for (const [字, 码] of [
          ["兆", "irx"],
          ["交", "hno"],
          ["舌", "eyd"],
          ["戈", "atn"],
          ["方", "oxt"],
          ["衡", "rwln"],
          ["磨", "aas"],
          ["羌", "qzx"],
          ["鬼", "pin"],
          ["断", "qztt"],
          ["冉", "bffn"],
          ["半", "uhln"],
          ["毛", "dzcn"],
          ["仕", "tftn"],
          ["汨", "icyn"],
          ["闫", "rdsn"],
          ["术", "uo"],
          ["晕", "cnl"],
          ["苎", "jmg"],
          ["承", "ndip"],
          ["鬯", "njjx"],
        ]) {
          expect(单字码.get(字)).toBe(码);
        }
      }
      if (filename === "cqkm.yaml") {
        const 单字码 = new Set(
          记录.codes.map((条目) => `${条目.词}\t${条目.全码}`),
        );
        for (const [字, 码] of [
          ["豆", "dkgy"],
          ["鬲", "gkgd"],
          ["襄", "xugj"],
          ["首", "syqk"],
          ["云", "yjxx"],
          ["争", "zevd"],
          ["习", "xxkk"],
          ["食", "shii"],
        ]) {
          expect(单字码.has(`${字}\t${码}`)).toBe(true);
        }
      }
    }, 30_000);
  }
});
