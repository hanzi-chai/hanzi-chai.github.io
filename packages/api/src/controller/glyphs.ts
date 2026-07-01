import type { IRequest } from "itty-router";
import type { Env } from "../dto/context";
import { Err, ErrCode } from "../error/error";

const table = "glyphs";

/** GET:/glyphs */
export async function List(_request: Request, env: Env) {
  const { results } = await env.CHAI.prepare(
    `SELECT * FROM ${table}`,
  ).all();
  return results;
}

/** GET:/glyphs/:id */
export async function Info(request: IRequest, env: Env) {
  const id = parseInt(request.params.id, 10);
  if (!Number.isInteger(id)) return new Err(ErrCode.ParamInvalid, "ID不正确");
  const res = await env.CHAI.prepare(
    `SELECT * FROM ${table} WHERE id=? LIMIT 1`,
  )
    .bind(id)
    .first();
  if (!res) return new Err(ErrCode.RecordNotFound, "字形不存在");
  return res;
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
    body;
  try {
    await env.CHAI.prepare(
      `INSERT INTO ${table} (id, type, operator, \`references\`, strokes, gf0014_id, gf3001_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        type,
        operator ?? null,
        JSON.stringify(references),
        JSON.stringify(strokes),
        gf0014_id ?? null,
        gf3001_id ?? null,
      )
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
      body.map((item: any) =>
        statement.bind(
          item.id,
          item.type,
          item.operator ?? null,
          JSON.stringify(item.references),
          JSON.stringify(item.strokes),
          item.gf0014_id ?? null,
          item.gf3001_id ?? null,
        ),
      ),
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
  const { type, operator, references, strokes, gf0014_id, gf3001_id } = body;
  try {
    await env.CHAI.prepare(
      `UPDATE ${table} SET type=?, operator=?, \`references\`=?, strokes=?, gf0014_id=?, gf3001_id=? WHERE id=?`,
    )
      .bind(
        type,
        operator ?? null,
        JSON.stringify(references),
        JSON.stringify(strokes),
        gf0014_id ?? null,
        gf3001_id ?? null,
        id,
      )
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
