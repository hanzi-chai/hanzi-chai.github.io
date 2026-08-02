/**
 * 从服务器下载所有字符数据和字形数据，重新编排字形 ID。
 *
 * 编排逻辑：
 * 1. 单笔画部件（strokes.length === 1）→ ID 1-64
 * 2. 所有部件类字形 → ID 1-4096
 * 3. 复合体 → ID 4096+
 *
 * 编排后同时更新字符数据和字形数据中对字形 ID 的所有引用。
 *
 * 用法：
 *   bun run scripts/reindex-glyphs.ts --dry-run   # 仅预览，不修改
 *   bun run scripts/reindex-glyphs.ts              # 执行重新编排
 *
 * 需要设置环境变量 JWT（用于 API 认证）。
 */

import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import {
  type 基本字形数据,
  type 基本部件数据,
  type 字符数据,
  type 笔画名称,
  默认分类器,
} from "hanzi-chai";
import { sortBy } from "lodash-es";
import { createClient } from "../packages/api/src/client";

const { get, post, del } = createClient(() => process.env.JWT ?? null);

const maxSingleStrokeComponents = 64;
const maxComponents = 4096;
const 全部笔画名称 = Object.keys(默认分类器) as 笔画名称[];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("⚠️  DRY RUN 模式：只检查不修改\n");
  }

  // ─── 第 1 步：下载数据 ───
  console.log("正在从服务器获取所有字符数据...");
  // const characters = await get<字符数据[]>("/characters");
  const characters: 字符数据[] = JSON.parse(
    readFileSync("characters.json", "utf-8"),
  );
  if (!Array.isArray(characters)) {
    console.error("获取字符数据失败:", characters);
    process.exit(1);
  }
  console.log(`获取到 ${characters.length} 个字符`);
  // writeFileSync("characters.json", JSON.stringify(characters, null, 2));

  console.log("正在从服务器获取所有字形数据...");
  // const glyphs = await get<基本字形数据[]>("/glyphs");
  const glyphs: 基本字形数据[] = JSON.parse(
    readFileSync("glyphs.json", "utf-8"),
  );
  if (!Array.isArray(glyphs)) {
    console.error("获取字形数据失败:", glyphs);
    process.exit(1);
  }
  console.log(`获取到 ${glyphs.length} 个字形\n`);
  // writeFileSync("glyphs.json", JSON.stringify(glyphs, null, 2));

  // ─── 第 2 步：分类 ───
  let singleStrokeComponents: 基本部件数据[] = [];
  let multiStrokeComponents: 基本部件数据[] = [];
  let compounds: 基本字形数据[] = [];

  for (const glyph of glyphs) {
    if (glyph.type === "compound") {
      compounds.push(glyph);
    } else {
      const strokeCount = glyph.strokes?.length ?? 0;
      if (strokeCount === 1) {
        singleStrokeComponents.push(glyph);
      } else {
        multiStrokeComponents.push(glyph);
      }
    }
  }

  console.log("字形分类：");
  console.log(`  单笔画部件：${singleStrokeComponents.length} 个`);
  console.log(`  多笔画部件：${multiStrokeComponents.length} 个`);
  console.log(
    `  部件合计：${singleStrokeComponents.length + multiStrokeComponents.length} 个`,
  );
  console.log(`  复合体：${compounds.length} 个\n`);

  // ─── 第 3 步：排序并分配新 ID ───
  const allSingleStrokes = singleStrokeComponents.map(
    (g) => g.strokes[0]!.feature,
  );
  const notAppeared = 全部笔画名称.filter(
    (name) => !allSingleStrokes.includes(name),
  );
  if (notAppeared.length > 0) {
    console.warn(
      `⚠️ 注意：以下笔画未出现在任何单笔画部件中：${notAppeared.join(", ")}`,
    );
  }
  singleStrokeComponents = sortBy(singleStrokeComponents, (a) =>
    全部笔画名称.indexOf(a.strokes[0]!.feature),
  );
  multiStrokeComponents = sortBy(
    multiStrokeComponents,
    (a) => a.strokes.length,
    (a) => a.strokes.map((x) => 默认分类器[x.feature]).join(""),
  );
  compounds = sortBy(compounds, (a) => a.id);

  const idMap = new Map<number, number>();
  let nextId = 1;

  // 单笔画部件：从 1 开始
  for (const g of singleStrokeComponents) {
    idMap.set(g.id, nextId++);
  }
  const singleStrokeEnd = nextId - 1;

  // 多笔画部件：从 maxSingleStrokeComponents 开始
  nextId = maxSingleStrokeComponents;
  for (const g of multiStrokeComponents) {
    idMap.set(g.id, nextId++);
  }
  const componentEnd = nextId - 1;

  // 复合体：从 maxComponents 开始
  nextId = maxComponents;
  for (const g of compounds) {
    idMap.set(g.id, nextId++);
  }
  const compoundEnd = nextId - 1;

  console.log("新 ID 分配：");
  console.log(`  单笔画部件：1 - ${singleStrokeEnd}`);
  console.log(`  其他部件：${maxSingleStrokeComponents} - ${componentEnd}`);
  console.log(`  复合体：${maxComponents} - ${compoundEnd}\n`);

  // 验证约束
  if (singleStrokeEnd > maxSingleStrokeComponents) {
    console.error(
      `❌ 单笔画部件数量 (${singleStrokeEnd}) 超出 1-${maxSingleStrokeComponents} 范围！`,
    );
    process.exit(1);
  }
  if (componentEnd > maxComponents) {
    console.error(
      `❌ 部件总数 (${componentEnd}) 超出 1-${maxComponents} 范围！`,
    );
    process.exit(1);
  }

  // ─── 第 4 步：转换数据 ───
  function remapGlyph(g: 基本字形数据): 基本字形数据 {
    const newGlyph = { ...g, id: idMap.get(g.id)! };
    if (newGlyph.references) {
      newGlyph.references = newGlyph.references.map((ref) => ({
        ...ref,
        id: idMap.get(ref.id) ?? ref.id,
      }));
    }
    return newGlyph;
  }

  function remapCharacter(c: 字符数据): 字符数据 {
    return {
      ...c,
      glyphs: c.glyphs.map((g) => ({
        ...g,
        id: idMap.get(g.id) ?? g.id,
      })),
    };
  }

  const newGlyphs = glyphs.map(remapGlyph);
  const newCharacters = characters.map(remapCharacter);

  // 验证：确保所有引用都被正确映射
  const unmappedRefs: number[] = [];
  for (const g of newGlyphs) {
    if (g.references) {
      for (const ref of g.references) {
        if (!idMap.has(ref.id) && glyphs.some((og) => og.id === ref.id)) {
          unmappedRefs.push(ref.id);
        }
      }
    }
  }
  if (unmappedRefs.length > 0) {
    console.error(
      `❌ 发现未映射的字形引用 ID：${[...new Set(unmappedRefs)].join(", ")}`,
    );
    process.exit(1);
  }

  // ─── DRY RUN：到此为止 ───
  if (dryRun) {
    console.log("转换示例（前 10 个）：");
    const examples = [
      ...singleStrokeComponents.slice(0, 3),
      ...multiStrokeComponents.slice(0, 3),
      ...compounds.slice(0, 4),
    ];
    for (const g of examples) {
      const newId = idMap.get(g.id)!;
      const label =
        g.type === "component"
          ? `部件 (${g.strokes?.length ?? 0} 笔)`
          : `复合体 (operator: ${(g as any).operator})`;
      console.log(`  ID ${g.id} → ${newId}  ${label}`);
    }

    // 展示字符引用的变化
    const charExamples = characters
      .filter((c) => c.glyphs.some((g) => g.id !== idMap.get(g.id)))
      .slice(0, 5);
    if (charExamples.length > 0) {
      console.log("\n字符引用变化示例：");
      for (const c of charExamples) {
        const oldIds = c.glyphs.map((g) => g.id);
        const newIds = c.glyphs.map((g) => idMap.get(g.id));
        console.log(
          `  U+${c.unicode.toString(16).toUpperCase().padStart(4, "0")}: ` +
            `glyphs [${oldIds.join(", ")}] → [${newIds.join(", ")}]`,
        );
      }
    }

    console.log("\n使用不带 --dry-run 参数运行以实际执行修改。");
    return;
  }

  // ─── 第 5 步：上传 ───
  console.log("\n━━━ 第 1/4 步：删除所有字符数据 ━━━");
  const result1 = await del<true>("/characters", {
    unicodes: characters.map((c) => c.unicode),
  });
  if (result1 !== true) {
    console.error("删除字符失败:", result1);
    process.exit(1);
  }
  console.log("  完成");

  console.log("━━━ 第 2/4 步：删除所有字形数据 ━━━");
  const result2 = await del<true>("/glyphs");
  if (result2 !== true) {
    console.error("删除字形失败:", result2);
    process.exit(1);
  }
  console.log("  完成");

  const batchSize = 65536; // 批量上传大小限制

  console.log("━━━ 第 3/4 步：插入重新编排的字形 ━━━");
  for (let i = 0; i < newGlyphs.length; i += batchSize) {
    const batch = newGlyphs.slice(i, i + batchSize);
    console.log(
      `  上传字形 ${i + 1} - ${i + batch.length} / ${newGlyphs.length}`,
    );
    const result3 = await post<true>("/glyphs/batch", batch);
    if (result3 !== true) {
      console.error("插入字形失败:", result3);
      process.exit(1);
    }
  }
  console.log("  完成");

  console.log("━━━ 第 4/4 步：插入更新引用后的字符数据 ━━━");
  for (let i = 0; i < newCharacters.length; i += batchSize) {
    const batch = newCharacters.slice(i, i + batchSize);
    console.log(
      `  上传字符 ${i + 1} - ${i + batch.length} / ${newCharacters.length}`,
    );
    const result4 = await post<true>("/characters/batch", batch);
    if (result4 !== true) {
      console.error("插入字符失败:", result4);
      process.exit(1);
    }
  }
  console.log("  完成");

  console.log("\n✅ 全部完成！字形 ID 已重新编排。");
  console.log(`   单笔画部件：ID 1 - ${singleStrokeEnd}`);
  console.log(`   部件总计：ID 1 - ${componentEnd}`);
  console.log(`   复合体：ID 4096 - ${compoundEnd}`);
}

main().catch((err) => {
  console.error("\n执行失败:", err);
  process.exit(1);
});
