import type { 字形数据, 字符数据, 结构描述字符 } from "hanzi-chai";
import type { IRequest } from "itty-router";
import type { Env } from "../dto/context";
import { Err, ErrCode } from "../error/error";
import type { 字符模型 } from "./characters";

const table = "glyphs";

interface 字形模型 extends Pick<字形数据, "id" | "type"> {
  name: string | null;
  operator: 结构描述字符 | null;
  references: string | null; // JSON 字符串
  strokes: string | null; // JSON 字符串
  gf0014_id: number | null;
  gf3001_id: number | null;
}

function 转数据(数据: 字形模型): 字形数据 {
  const { references, strokes, gf0014_id, gf3001_id } = 数据;
  return {
    ...数据,
    name: 数据.name ?? undefined,
    operator: 数据.operator ?? undefined,
    references: references
      ? (JSON.parse(references) as 字形数据["references"])
      : undefined,
    strokes: strokes ? (JSON.parse(strokes) as 字形数据["strokes"]) : undefined,
    gf0014_id: gf0014_id ?? undefined,
    gf3001_id: gf3001_id ?? undefined,
  } as 字形数据;
}

function 转模型(数据: 字形数据): 字形模型 {
  return {
    ...数据,
    name: 数据.name ?? null,
    operator: 数据.operator ?? null,
    references: 数据.references ? JSON.stringify(数据.references) : null,
    strokes: 数据.strokes ? JSON.stringify(数据.strokes) : null,
    gf0014_id: 数据.gf0014_id ?? null,
    gf3001_id: 数据.gf3001_id ?? null,
  };
}

/** GET:/glyphs */
export async function List(_request: Request, env: Env) {
  const { results } = await env.CHAI.prepare(
    `SELECT * FROM ${table}`,
  ).all<字形模型>();
  return results.map(转数据);
}

/** GET:/glyphs/:id */
export async function Info(request: IRequest, env: Env) {
  const id = parseInt(request.params.id, 10);
  if (!Number.isInteger(id)) return new Err(ErrCode.ParamInvalid, "ID不正确");
  const res = await env.CHAI.prepare(
    `SELECT * FROM ${table} WHERE id=? LIMIT 1`,
  )
    .bind(id)
    .first<字形模型>();
  if (!res) return new Err(ErrCode.RecordNotFound, "字形不存在");
  return 转数据(res);
}

async function getNextId(type: 字形模型["type"], env: Env): Promise<number> {
  const allIDs = await env.CHAI.prepare(`SELECT id FROM ${table}`).all<{
    id: number;
  }>();
  const idSet = new Set(allIDs.results.map((item) => item.id));
  let id = 1;
  while (idSet.has(id)) {
    id++;
  }
  return id;
}

/** POST:/glyphs */
export async function Create(request: IRequest, env: Env) {
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  const { name, type, operator, references, strokes, gf0014_id, gf3001_id } =
    转模型(body);
  const id = await getNextId(type, env);
  try {
    await env.CHAI.prepare(
      `INSERT INTO ${table} (id, name, type, operator, \`references\`, strokes, gf0014_id, gf3001_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, name, type, operator, references, strokes, gf0014_id, gf3001_id)
      .run();
  } catch (err) {
    return new Err(
      ErrCode.DataCreateFailed,
      `创建失败（${(err as Error).message}）`,
    );
  }
  return id;
}

/** POST:/glyphs/batch */
export async function CreateBatch(request: IRequest, env: Env) {
  let body: any[];
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  try {
    const statement = env.CHAI.prepare(
      `INSERT INTO ${table} (id, name, type, operator, \`references\`, strokes, gf0014_id, gf3001_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    await env.CHAI.batch(
      body.map((item: any) => {
        const {
          id,
          name,
          type,
          operator,
          references,
          strokes,
          gf0014_id,
          gf3001_id,
        } = 转模型(item);
        return statement.bind(
          id,
          name,
          type,
          operator,
          references,
          strokes,
          gf0014_id,
          gf3001_id,
        );
      }),
    );
  } catch (err) {
    return new Err(
      ErrCode.DataCreateFailed,
      `批量创建失败（${(err as Error).message}）`,
    );
  }
  return true;
}

/** PUT:/glyphs/:id */
export async function Update(request: IRequest, env: Env) {
  const id = parseInt(request.params.id, 10);
  if (!Number.isInteger(id)) return new Err(ErrCode.ParamInvalid, "ID不正确");

  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  const { name, type, operator, references, strokes, gf0014_id, gf3001_id } =
    转模型(body);
  try {
    await env.CHAI.prepare(
      `UPDATE ${table} SET name=?, type=?, operator=?, \`references\`=?, strokes=?, gf0014_id=?, gf3001_id=? WHERE id=?`,
    )
      .bind(name, type, operator, references, strokes, gf0014_id, gf3001_id, id)
      .run();
  } catch (err) {
    return new Err(
      ErrCode.DataUpdateFailed,
      `更新失败（${(err as Error).message}）`,
    );
  }
  return true;
}

export async function UpdateBatch(request: IRequest, env: Env) {
  let body: any[];
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  try {
    const statement = env.CHAI.prepare(
      `UPDATE ${table} SET name=?, type=?, operator=?, \`references\`=?, strokes=?, gf0014_id=?, gf3001_id=? WHERE id=?`,
    );
    await env.CHAI.batch(
      body.map((item: any) => {
        const { id, name, type, operator, references, strokes, gf0014_id, gf3001_id } = 转模型(item);
        return statement.bind(
          name,
          type,
          operator,
          references,
          strokes,
          gf0014_id,
          gf3001_id,
          id
        );
      }),
    );
  } catch (err) {
    return new Err(
      ErrCode.DataUpdateFailed,
      `批量更新失败（${(err as Error).message}）`,
    );
  }
  return true;
}

async function prepareReferenceSet(env: Env): Promise<Set<number>> {
  // 检查是否被 characters 表的 glyphs 字段引用
  const allCharacters = await env.CHAI.prepare(
    `SELECT * FROM characters`,
  ).all<字符模型>();

  // 检查是否被 glyphs 表的 references 字段引用
  const allGlyphs = await env.CHAI.prepare(
    `SELECT * from ${table}`,
  ).all<字形模型>();

  const referenceSet = new Set<number>();
  for (const character of allCharacters.results) {
    const glyphs = JSON.parse(character.glyphs) as 字符数据["glyphs"];
    for (const glyph of glyphs) {
      referenceSet.add(glyph.id);
    }
  }
  for (const glyph of allGlyphs.results) {
    if (!glyph.references) continue;
    const references =
      (JSON.parse(glyph.references) as 字形数据["references"]) ?? [];
    for (const ref of references) {
      referenceSet.add(ref.id);
    }
  }
  return referenceSet;
}

/** DELETE:/glyphs/:id */
export async function Delete(request: IRequest, env: Env) {
  const id = parseInt(request.params.id, 10);
  if (!Number.isInteger(id)) return new Err(ErrCode.ParamInvalid, "ID不正确");

  const referenceSet = await prepareReferenceSet(env);
  if (referenceSet.has(id)) {
    return new Err(
      ErrCode.DataDeleteFailed,
      "删除失败：该字形被其他字形或字符引用",
    );
  }

  try {
    await env.CHAI.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();
  } catch (err) {
    return new Err(
      ErrCode.DataDeleteFailed,
      `删除失败（${(err as Error).message}）`,
    );
  }
  return true;
}

export async function DeleteBatch(request: IRequest, env: Env) {
  let body: { ids: number[] };
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  const { ids } = body;
  if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
    return new Err(ErrCode.ParamInvalid, "ID列表不正确");
  }

  const referenceSet = await prepareReferenceSet(env);
  for (const id of ids) {
    if (referenceSet.has(id)) {
      return new Err(
        ErrCode.DataDeleteFailed,
        `删除失败：字形 ${id} 被其他字形或字符引用`,
      );
    }
  }

  try {
    const statement = env.CHAI.prepare(`DELETE FROM ${table} WHERE id=?`);
    await env.CHAI.batch(ids.map((id) => statement.bind(id)));
  } catch (err) {
    return new Err(
      ErrCode.DataDeleteFailed,
      `批量删除失败（${(err as Error).message}）`,
    );
  }
  return true;
}

export async function DeleteAll(_request: IRequest, env: Env) {
  try {
    await env.CHAI.prepare(`DELETE FROM ${table}`).run();
  } catch (err) {
    return new Err(
      ErrCode.DataDeleteFailed,
      `删除所有字形失败（${(err as Error).message}）`,
    );
  }
  return true;
}

/** PUT:/glyphs/replace-id */
export async function ReplaceId(request: IRequest, env: Env) {
  let body: { oldId: number; newId: number };
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  const { oldId, newId } = body;
  if (!Number.isInteger(oldId) || !Number.isInteger(newId)) {
    return new Err(ErrCode.ParamInvalid, "ID不正确");
  }
  if (oldId === newId) return true;

  // 更新 characters 表的 glyphs 字段
  const { results: chars } = await env.CHAI.prepare(
    `SELECT unicode, glyphs FROM characters WHERE glyphs LIKE ? OR glyphs LIKE ?`,
  )
    .bind(`%"id":${oldId},%`, `%"id":${oldId}}%`)
    .all<{ unicode: number; glyphs: string }>();
  if (chars?.length) {
    const stmt = env.CHAI.prepare(
      `UPDATE characters SET glyphs=? WHERE unicode=?`,
    );
    const batch = chars
      .map((c) => {
        const parsed: { id: number; sources: string[] }[] = JSON.parse(
          c.glyphs,
        );
        let changed = false;
        for (const item of parsed) {
          if (item.id === oldId) {
            item.id = newId;
            changed = true;
          }
        }
        return changed ? stmt.bind(JSON.stringify(parsed), c.unicode) : null;
      })
      .filter(Boolean);
    if (batch.length) await env.CHAI.batch(batch as any);
  }

  // 更新 glyphs 表的 references 字段
  const { results: glyphs } = await env.CHAI.prepare(
    `SELECT id, \`references\` FROM glyphs WHERE (\`references\` LIKE ? OR \`references\` LIKE ?) AND id != ?`,
  )
    .bind(`%"id":${oldId},%`, `%"id":${oldId}}%`, oldId)
    .all<{ id: number; references: string }>();
  if (glyphs?.length) {
    const stmt = env.CHAI.prepare(
      `UPDATE glyphs SET \`references\`=? WHERE id=?`,
    );
    const batch = glyphs
      .map((g) => {
        const parsed: {
          id: number;
          xbegin?: number;
          ybegin?: number;
          xend?: number;
          yend?: number;
        }[] = JSON.parse(g.references);
        let changed = false;
        for (const item of parsed) {
          if (item.id === oldId) {
            item.id = newId;
            changed = true;
          }
        }
        return changed ? stmt.bind(JSON.stringify(parsed), g.id) : null;
      })
      .filter(Boolean);
    if (batch.length) await env.CHAI.batch(batch as any);
  }

  return true;
}
