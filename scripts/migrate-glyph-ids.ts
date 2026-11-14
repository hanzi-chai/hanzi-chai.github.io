/** 按冻结映射迁移旧数据或旧方案；不重新排序、不调用远程写接口。 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { dump, load } from "js-yaml";
import type { 字形数据, 字符数据 } from "../src/data.js";
import { 格式化字形ID } from "../src/glyph-id.js";
import { 是记录 } from "../src/validation.js";
import { 迁移旧字形ID } from "./migrations/glyph-id-legacy.js";

export { 迁移旧字形ID } from "./migrations/glyph-id-legacy.js";

/** 线上完成数据库切换前，下载器仍能把旧编号快照转为新编号。 */
export function 迁移旧字库(glyphs: 字形数据[], characters: 字符数据[]) {
  // 00000 是冻结快照中的第一笔横；旧库的最小 ID 为 1。
  if (glyphs.some((字形) => 字形.id === 0)) return { glyphs, characters };
  return {
    glyphs: glyphs.map((字形) => ({
      ...字形,
      id: 迁移旧字形ID(字形.id),
      ...(字形.references
        ? {
            references: 字形.references.map((引用) => ({
              ...引用,
              id: 迁移旧字形ID(引用.id),
            })),
          }
        : {}),
    })) as 字形数据[],
    characters: characters.map((字符) => ({
      ...字符,
      glyphs: 字符.glyphs.map((字形) => ({
        ...字形,
        id: 迁移旧字形ID(字形.id),
      })),
    })),
  };
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "data-dir": { type: "string", default: "data" },
      out: { type: "string", default: "output/glyph-id-migration/converted" },
      config: { type: "string" },
    },
    strict: true,
  });
  await mkdir(values.out!, { recursive: true });
  if (values.config) {
    const 配置 = load(await readFile(values.config, "utf8"));
    const 名称转换 = (text: string) =>
      text.replace(
        /字形-(\d+)/g,
        (_, id: string) => `字形-${格式化字形ID(迁移旧字形ID(Number(id)))}`,
      );
    const walk = (value: unknown, keys: string[] = []): unknown => {
      if (typeof value === "string") return 名称转换(value);
      if (typeof value === "number") {
        const key = keys.at(-1);
        if (
          (key === "id" && keys.includes("data")) ||
          keys.includes("fusion") ||
          (keys.includes("glyph_algebra") &&
            ["from", "to", "references", "id_set"].includes(key!))
        )
          return 迁移旧字形ID(value);
        return value;
      }
      if (Array.isArray(value)) return value.map((x) => walk(x, keys));
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            keys[0] === "analysis" &&
            ["customize", "dynamic_customize"].includes(keys[1]!) &&
            /^\d+$/.test(key)
              ? `字形-${格式化字形ID(迁移旧字形ID(Number(key)))}`
              : 名称转换(key),
            walk(item, [...keys, key]),
          ]),
        );
      return value;
    };
    const 结果 = walk(配置);
    if (是记录(结果) && 是记录(结果.analysis) && "fusion" in 结果.analysis) {
      if (是记录(结果.data) && "fusion" in 结果.data)
        throw new Error(
          "analysis.fusion 与 data.fusion 同时存在，请先确定要保留的配置",
        );
      结果.data = {
        ...(是记录(结果.data) ? 结果.data : {}),
        fusion: 结果.analysis.fusion,
      };
      delete 结果.analysis.fusion;
    }
    await writeFile(
      path.join(values.out!, path.basename(values.config)),
      dump(结果, { lineWidth: -1 }),
    );
  } else {
    const glyphs = JSON.parse(
      await readFile(path.join(values["data-dir"]!, "glyphs.json"), "utf8"),
    );
    const characters = JSON.parse(
      await readFile(path.join(values["data-dir"]!, "characters.json"), "utf8"),
    );
    const 结果 = 迁移旧字库(glyphs, characters);
    await Promise.all(
      Object.entries(结果).map(([name, data]) =>
        writeFile(path.join(values.out!, `${name}.json`), JSON.stringify(data)),
      ),
    );
  }
  console.log(`已写入 ${values.out}`);
}
