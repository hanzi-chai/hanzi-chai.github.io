import type { 字形数据, 结构描述字符 } from "hanzi-chai";
import type { IRequest } from "itty-router";
import type { Env } from "../dto/context";
import { Err, ErrCode } from "../error/error";

const table = "glyphs";

interface 字形模型 extends Pick<字形数据, "id" | "type"> {
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

/** POST:/glyphs */
export async function Create(request: IRequest, env: Env) {
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  const { id, type, operator, references, strokes, gf0014_id, gf3001_id } =
    转模型(body);
  try {
    await env.CHAI.prepare(
      `INSERT INTO ${table} (id, type, operator, \`references\`, strokes, gf0014_id, gf3001_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, type, operator, references, strokes, gf0014_id, gf3001_id)
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
      `INSERT INTO ${table} (id, type, operator, \`references\`, strokes, gf0014_id, gf3001_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    await env.CHAI.batch(
      body.map((item: any) => {
        const {
          id,
          type,
          operator,
          references,
          strokes,
          gf0014_id,
          gf3001_id,
        } = 转模型(item);
        return statement.bind(
          id,
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
  const { type, operator, references, strokes, gf0014_id, gf3001_id } =
    转模型(body);
  try {
    await env.CHAI.prepare(
      `UPDATE ${table} SET type=?, operator=?, \`references\`=?, strokes=?, gf0014_id=?, gf3001_id=? WHERE id=?`,
    )
      .bind(type, operator, references, strokes, gf0014_id, gf3001_id, id)
      .run();
  } catch (err) {
    return new Err(
      ErrCode.DataUpdateFailed,
      `更新失败（${(err as Error).message}）`,
    );
  }
  return true;
}

/** DELETE:/glyphs/:id */
export async function Delete(request: IRequest, env: Env) {
  const id = parseInt(request.params.id, 10);
  if (!Number.isInteger(id)) return new Err(ErrCode.ParamInvalid, "ID不正确");

  // 检查是否被 characters 表的 glyphs 字段引用
  const charRef = await env.CHAI.prepare(
    `SELECT unicode FROM characters WHERE glyphs LIKE ? OR glyphs LIKE ? LIMIT 1`,
  )
    .bind(`%"id":${id},%`, `%"id":${id}}%`)
    .first<{ unicode: number }>();
  if (charRef) {
    return new Err(
      ErrCode.DataDeleteFailed,
      `无法删除：字形 ${id} 被字符 U+${charRef.unicode.toString(16).toUpperCase().padStart(4, "0")} 引用`,
    );
  }

  // 检查是否被 glyphs 表的 references 字段引用
  const glyphRef = await env.CHAI.prepare(
    `SELECT id FROM glyphs WHERE (\`references\` LIKE ? OR \`references\` LIKE ?) AND id != ? LIMIT 1`,
  )
    .bind(`%"id":${id},%`, `%"id":${id}}%`, id)
    .first<{ id: number }>();
  if (glyphRef) {
    return new Err(
      ErrCode.DataDeleteFailed,
      `无法删除：字形 ${id} 被字形 ${glyphRef.id} 引用`,
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
        const parsed: { id: number; sources: string[] }[] = JSON.parse(c.glyphs);
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
        const parsed: { id: number; xbegin?: number; ybegin?: number; xend?: number; yend?: number }[] =
          JSON.parse(g.references);
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
