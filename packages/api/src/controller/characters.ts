import type { IRequest } from "itty-router";
import type { Env } from "../dto/context";
import { Err, ErrCode } from "../error/error";

const table = "characters";

/** GET:/characters */
export async function List(_request: Request, env: Env) {
  const { results } = await env.CHAI.prepare(
    `SELECT * FROM ${table}`,
  ).all();
  return results;
}

/** GET:/characters/:unicode */
export async function Info(request: IRequest, env: Env) {
  const unicode = parseInt(request.params.unicode, 10);
  if (!Number.isInteger(unicode))
    return new Err(ErrCode.ParamInvalid, "Unicode不正确");
  const res = await env.CHAI.prepare(
    `SELECT * FROM ${table} WHERE unicode=? LIMIT 1`,
  )
    .bind(unicode)
    .first();
  if (!res) return new Err(ErrCode.RecordNotFound, "字符不存在");
  return res;
}

/** POST:/characters */
export async function Create(request: IRequest, env: Env) {
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  const { unicode, tygf, gb2312, glyphs, name, ambiguous } = body;
  const glyphsJson = JSON.stringify(glyphs);
  try {
    await env.CHAI.prepare(
      `INSERT INTO ${table} (unicode, tygf, gb2312, glyphs, name, ambiguous) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        unicode,
        tygf ?? null,
        gb2312 ?? null,
        glyphsJson,
        name ?? null,
        ambiguous ?? null,
      )
      .run();
  } catch (err) {
    return new Err(
      ErrCode.DataCreateFailed,
      `创建失败（${(err as Error).message}）`,
    );
  }
  return unicode;
}

/** POST:/characters/batch */
export async function CreateBatch(request: IRequest, env: Env) {
  let body: any[];
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  try {
    const statement = env.CHAI.prepare(
      `INSERT INTO ${table} (unicode, tygf, gb2312, glyphs, name, ambiguous) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    await env.CHAI.batch(
      body.map((item: any) =>
        statement.bind(
          item.unicode,
          item.tygf ?? null,
          item.gb2312 ?? null,
          JSON.stringify(item.glyphs),
          item.name ?? null,
          item.ambiguous ?? null,
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

/** PUT:/characters/:unicode */
export async function Update(request: IRequest, env: Env) {
  const unicode = parseInt(request.params.unicode, 10);
  if (!Number.isInteger(unicode))
    return new Err(ErrCode.ParamInvalid, "Unicode不正确");

  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  const { tygf, gb2312, glyphs, name, ambiguous } = body;
  const glyphsJson = JSON.stringify(glyphs);
  try {
    await env.CHAI.prepare(
      `UPDATE ${table} SET tygf=?, gb2312=?, glyphs=?, name=?, ambiguous=? WHERE unicode=?`,
    )
      .bind(
        tygf ?? null,
        gb2312 ?? null,
        glyphsJson,
        name ?? null,
        ambiguous ?? null,
        unicode,
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

/** DELETE:/characters/:unicode */
export async function Delete(request: IRequest, env: Env) {
  const unicode = parseInt(request.params.unicode, 10);
  if (!Number.isInteger(unicode))
    return new Err(ErrCode.ParamInvalid, "Unicode不正确");
  try {
    await env.CHAI.prepare(`DELETE FROM ${table} WHERE unicode=?`)
      .bind(unicode)
      .run();
  } catch (err) {
    return new Err(
      ErrCode.DataDeleteFailed,
      `删除失败（${(err as Error).message}）`,
    );
  }
  return true;
}
