/** 从已备份的 D1 SQLite 快照准备一次性迁移；本脚本不连接或修改远程数据库。 */
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { type 字形数据, type 字符数据, 校验字库整数 } from "../src/data.js";
import { 格式化字形ID } from "../src/glyph-id.js";
import { 迁移旧字形ID } from "./migrations/glyph-id-legacy.js";

interface 字形行 {
  id: number;
  type: 字形数据["type"];
  operator: string | null;
  references: string | null;
  strokes: string | null;
  name: string | null;
}
interface 字符行 {
  unicode: number;
  glyphs: string;
  tygf: 1 | 2 | 3 | null;
  gb2312: 1 | 2 | null;
  name: string | null;
}
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    snapshot: {
      type: "string",
      default: "output/online-glyph-id-cutover/snapshot.sqlite",
    },
    out: { type: "string", default: "output/online-glyph-id-cutover" },
  },
});
const 目录 = path.resolve(values.out!);
mkdirSync(目录, { recursive: true });
const db = new Database(values.snapshot!, { readonly: true });
const 字形 = db
  .query<字形行, []>(
    "SELECT id,type,operator,`references`,strokes,name FROM glyphs ORDER BY id",
  )
  .all();
const 字符 = db
  .query<字符行, []>(
    "SELECT unicode,glyphs,tygf,gb2312,name FROM characters ORDER BY unicode",
  )
  .all();
if (字形.some((x) => x.id === 0))
  throw new Error("快照已采用新编号，拒绝重复迁移");
const 映射 = new Map(字形.map((x) => [x.id, 迁移旧字形ID(x.id)]));
if (new Set(映射.values()).size !== 字形.length)
  throw new Error("映射存在重复新 ID");
const 转换 = (id: number) => {
  const value = 映射.get(id);
  if (value === undefined) throw new Error(`未知字形引用 ${id}`);
  return value;
};
const 新名称 = (name: string | null) => {
  const 匹配 = name?.match(/^(\d+)·包围外框$/);
  return 匹配 ? `${格式化字形ID(转换(Number(匹配[1])))}·包围外框` : name;
};
const 新字形 = 字形
  .map(
    (x) =>
      ({
        id: 转换(x.id),
        type: x.type,
        ...(x.operator === null ? {} : { operator: x.operator }),
        ...(x.references === null
          ? {}
          : {
              references: (JSON.parse(x.references) as { id: number }[]).map(
                (r) => ({ ...r, id: 转换(r.id) }),
              ),
            }),
        ...(x.strokes === null ? {} : { strokes: JSON.parse(x.strokes) }),
        ...(x.name === null ? {} : { name: 新名称(x.name) }),
      }) as 字形数据,
  )
  .sort((a, b) => a.id - b.id);
const 新字符 = 字符.map(
  (x) =>
    ({
      unicode: x.unicode,
      glyphs: (JSON.parse(x.glyphs) as 字符数据["glyphs"]).map((g) => ({
        ...g,
        id: 转换(g.id),
      })),
      ...(x.tygf === null ? {} : { tygf: x.tygf }),
      ...(x.gb2312 === null ? {} : { gb2312: x.gb2312 }),
      ...(x.name === null ? {} : { name: x.name }),
    }) as 字符数据,
);
const 错误 = 校验字库整数([新字形, 新字符]);
if (错误) throw new Error(错误);
const quote = (v: string | number | null) =>
  v === null
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : `'${v.replaceAll("'", "''")}'`;
const statements = [
  "CREATE TABLE _glyph_id_map_v1(old_id INTEGER PRIMARY KEY,new_id INTEGER NOT NULL UNIQUE,old_type TEXT NOT NULL,old_operator TEXT,old_references TEXT,old_strokes TEXT,old_name TEXT,new_name TEXT);",
  "CREATE TABLE _glyph_id_characters_v1(unicode INTEGER PRIMARY KEY,old_glyphs TEXT NOT NULL);",
  "CREATE TABLE _glyph_id_cutover_v1(id INTEGER PRIMARY KEY CHECK(id IN(1,2)));",
];
function inserts(table: string, rows: (string | number | null)[][]) {
  let batch: string[] = [],
    size = 0;
  const flush = () => {
    if (batch.length)
      statements.push(`INSERT INTO ${table} VALUES ${batch.join(",")};`);
    batch = [];
    size = 0;
  };
  for (const row of rows) {
    const text = `(${row.map(quote).join(",")})`;
    const bytes = Buffer.byteLength(text);
    if (bytes > 60000) throw new Error("单条暂存记录超长");
    if (size + bytes > 60000) flush();
    batch.push(text);
    size += bytes + 1;
  }
  flush();
}
inserts(
  "_glyph_id_map_v1",
  字形.map((x) => [
    x.id,
    转换(x.id),
    x.type,
    x.operator,
    x.references,
    x.strokes,
    x.name,
    新名称(x.name),
  ]),
);
inserts(
  "_glyph_id_characters_v1",
  字符.map((x) => [x.unicode, x.glyphs]),
);
const 前置 = `
SELECT CASE WHEN (SELECT COUNT(*) FROM glyphs) != ${字形.length} OR (SELECT COUNT(*) FROM characters) != ${字符.length} THEN RAISE(ABORT,'snapshot row count changed') END;
SELECT CASE WHEN EXISTS(SELECT 1 FROM glyphs g LEFT JOIN _glyph_id_map_v1 m ON m.old_id=g.id WHERE m.old_id IS NULL OR g.type IS NOT m.old_type OR g.operator IS NOT m.old_operator OR g.\`references\` IS NOT m.old_references OR g.strokes IS NOT m.old_strokes OR g.name IS NOT m.old_name) THEN RAISE(ABORT,'glyph snapshot changed') END;
SELECT CASE WHEN EXISTS(SELECT 1 FROM characters c LEFT JOIN _glyph_id_characters_v1 s ON s.unicode=c.unicode WHERE s.unicode IS NULL OR c.glyphs IS NOT s.old_glyphs) THEN RAISE(ABORT,'character snapshot changed') END;
SELECT CASE WHEN EXISTS(SELECT 1 FROM glyphs g,json_each(g.\`references\`) r LEFT JOIN _glyph_id_map_v1 m ON m.old_id=json_extract(r.value,'$.id') WHERE m.old_id IS NULL OR json_type(r.value,'$.id') IS NOT 'integer') THEN RAISE(ABORT,'dangling glyph reference') END;
SELECT CASE WHEN EXISTS(SELECT 1 FROM characters c,json_each(c.glyphs) r LEFT JOIN _glyph_id_map_v1 m ON m.old_id=json_extract(r.value,'$.id') WHERE m.old_id IS NULL OR json_type(r.value,'$.id') IS NOT 'integer') THEN RAISE(ABORT,'dangling character reference') END;
`;
function 改引用(table: string, column: string, from: string, to: string) {
  return `UPDATE ${table} SET \`${column}\`=(SELECT json_group_array(json(value)) FROM (SELECT json_set(j.value,'$.id',m.${to}) AS value FROM json_each(${table}.\`${column}\`) j JOIN _glyph_id_map_v1 m ON m.${from}=json_extract(j.value,'$.id') ORDER BY CAST(j.key AS INTEGER))) WHERE \`${column}\` IS NOT NULL;`;
}
const 正向 = `CREATE TRIGGER _glyph_id_apply_v1 AFTER INSERT ON _glyph_id_cutover_v1 WHEN NEW.id=1 BEGIN
${前置}
${改引用("glyphs", "references", "old_id", "new_id")}
${改引用("characters", "glyphs", "old_id", "new_id")}
UPDATE glyphs SET name=(SELECT m.new_name FROM _glyph_id_map_v1 m WHERE m.old_id=glyphs.id);
UPDATE glyphs SET id=-id-1;
UPDATE glyphs SET id=(SELECT m.new_id FROM _glyph_id_map_v1 m WHERE m.old_id=-glyphs.id-1);
SELECT CASE WHEN EXISTS(SELECT 1 FROM glyphs WHERE id<0 OR id>1048575) THEN RAISE(ABORT,'invalid final ID') END;
END;`;
const 反向 = `CREATE TRIGGER _glyph_id_rollback_v1 AFTER INSERT ON _glyph_id_cutover_v1 WHEN NEW.id=2 BEGIN
SELECT CASE WHEN (SELECT COUNT(*) FROM glyphs)!=${字形.length} OR (SELECT COUNT(*) FROM characters)!=${字符.length} THEN RAISE(ABORT,'rollback row count changed') END;
SELECT CASE WHEN EXISTS(SELECT 1 FROM glyphs g LEFT JOIN _glyph_id_map_v1 m ON m.new_id=g.id WHERE m.old_id IS NULL) THEN RAISE(ABORT,'rollback ID changed') END;
${改引用("glyphs", "references", "new_id", "old_id")}
${改引用("characters", "glyphs", "new_id", "old_id")}
UPDATE glyphs SET name=(SELECT m.old_name FROM _glyph_id_map_v1 m WHERE m.new_id=glyphs.id);
UPDATE glyphs SET id=-id-1;
UPDATE glyphs SET id=(SELECT m.old_id FROM _glyph_id_map_v1 m WHERE m.new_id=-glyphs.id-1);
END;`;
statements.push(正向, 反向);
writeFileSync(path.join(目录, "prepare.sql"), statements.join("\n"));
writeFileSync(
  path.join(目录, "apply.sql"),
  "INSERT INTO _glyph_id_cutover_v1(id) VALUES(1);\n",
);
writeFileSync(
  path.join(目录, "rollback.sql"),
  "INSERT INTO _glyph_id_cutover_v1(id) VALUES(2);\n",
);
writeFileSync(
  path.join(目录, "cleanup.sql"),
  "DROP TRIGGER _glyph_id_apply_v1;\nDROP TRIGGER _glyph_id_rollback_v1;\nDROP TABLE _glyph_id_cutover_v1;\nDROP TABLE _glyph_id_characters_v1;\nDROP TABLE _glyph_id_map_v1;\n",
);
mkdirSync(path.join(目录, "expected"), { recursive: true });
writeFileSync(path.join(目录, "expected/glyphs.json"), JSON.stringify(新字形));
writeFileSync(
  path.join(目录, "expected/characters.json"),
  JSON.stringify(新字符),
);
const 摘要 = {
  glyphs: 字形.length,
  characters: 字符.length,
  renamed_id_labels: 字形.filter((x) => 新名称(x.name) !== x.name).length,
  snapshot_sha256: createHash("sha256")
    .update(readFileSync(values.snapshot!))
    .digest("hex"),
  prepare_sql_sha256: createHash("sha256")
    .update(statements.join("\n"))
    .digest("hex"),
  existing_triggers: db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='trigger'",
    )
    .all(),
};
writeFileSync(path.join(目录, "plan.json"), JSON.stringify(摘要, null, 2));
console.log(JSON.stringify(摘要, null, 2));
db.close();
