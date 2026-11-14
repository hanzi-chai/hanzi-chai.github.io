import type { 字符数据 } from "hanzi-chai";
import type { IRequest } from "itty-router";
import type { Env } from "../dto/context";
import { 读取字符, 读取字符删除, 读取字符批量 } from "../dto/requests";
import { Err, ErrCode, Ok } from "../error/error";

const table = "characters";

export interface 字符模型 extends Pick<字符数据, "unicode"> {
  tygf: 1 | 2 | 3 | null;
  gb2312: 1 | 2 | null;
  glyphs: string; // JSON 字符串
}

function 转数据(数据: 字符模型): 字符数据 {
  return {
    unicode: 数据.unicode,
    tygf: 数据.tygf ?? undefined,
    gb2312: 数据.gb2312 ?? undefined,
    glyphs: JSON.parse(数据.glyphs) as 字符数据["glyphs"],
  };
}

function 转模型(数据: 字符数据): 字符模型 {
  return {
    unicode: 数据.unicode,
    tygf: 数据.tygf ?? null,
    gb2312: 数据.gb2312 ?? null,
    glyphs: JSON.stringify(数据.glyphs),
  };
}

/** GET:/characters */
export async function List(_request: Request, env: Env) {
  const { results } = await env.CHAI.prepare(
    `SELECT unicode, tygf, gb2312, glyphs FROM ${table}`,
  ).all<字符模型>();
  return results.map(转数据);
}

/** GET:/characters/:unicode */
export async function Info(request: IRequest, env: Env) {
  const unicode = parseInt(request.params.unicode, 10);
  if (!Number.isInteger(unicode))
    return new Err(ErrCode.ParamInvalid, "Unicode不正确");
  const res = await env.CHAI.prepare(
    `SELECT unicode, tygf, gb2312, glyphs FROM ${table} WHERE unicode=?`,
  )
    .bind(unicode)
    .first<字符模型>();
  if (!res) return new Err(ErrCode.RecordNotFound, "字符不存在");
  return 转数据(res);
}

/** POST:/characters */
export async function Create(request: IRequest, env: Env) {
  const body = await 读取字符(request);
  if (!Ok(body)) return body;
  try {
    const { unicode, tygf, gb2312, glyphs } = 转模型(body);
    await env.CHAI.prepare(
      `INSERT INTO ${table} (unicode, tygf, gb2312, glyphs) VALUES (?, ?, ?, ?)`,
    )
      .bind(unicode, tygf, gb2312, glyphs)
      .run();
    return unicode;
  } catch (err) {
    return new Err(
      ErrCode.DataCreateFailed,
      `创建失败（${(err as Error).message}）`,
    );
  }
}

/** POST:/characters/batch */
export async function CreateBatch(request: IRequest, env: Env) {
  const body = await 读取字符批量(request);
  if (!Ok(body)) return body;
  try {
    const statement = env.CHAI.prepare(
      `INSERT INTO ${table} (unicode, tygf, gb2312, glyphs) VALUES (?, ?, ?, ?)`,
    );
    await env.CHAI.batch(
      body.map((item) => {
        const { unicode, tygf, gb2312, glyphs } = 转模型(item);
        return statement.bind(unicode, tygf, gb2312, glyphs);
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

/** PUT:/characters/:unicode */
export async function Update(request: IRequest, env: Env) {
  const unicode = parseInt(request.params.unicode, 10);
  if (!Number.isInteger(unicode))
    return new Err(ErrCode.ParamInvalid, "Unicode不正确");

  const body = await 读取字符(request);
  if (!Ok(body)) return body;
  try {
    const { tygf, gb2312, glyphs } = 转模型(body);
    await env.CHAI.prepare(
      `UPDATE ${table} SET tygf=?, gb2312=?, glyphs=? WHERE unicode=?`,
    )
      .bind(tygf, gb2312, glyphs, unicode)
      .run();
  } catch (err) {
    return new Err(
      ErrCode.DataUpdateFailed,
      `更新失败（${(err as Error).message}）`,
    );
  }
  return true;
}

/** PUT:/characters/batch */
export async function UpdateBatch(request: IRequest, env: Env) {
  const body = await 读取字符批量(request);
  if (!Ok(body)) return body;
  try {
    const statement = env.CHAI.prepare(
      `UPDATE ${table} SET tygf=?, gb2312=?, glyphs=? WHERE unicode=?`,
    );
    await env.CHAI.batch(
      body.map((item) => {
        const { unicode, tygf, gb2312, glyphs } = 转模型(item);
        return statement.bind(tygf, gb2312, glyphs, unicode);
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

export async function DeleteBatch(request: IRequest, env: Env) {
  const body = await 读取字符删除(request);
  if (!Ok(body)) return body;
  try {
    const statement = env.CHAI.prepare(`DELETE FROM ${table} WHERE unicode=?`);
    await env.CHAI.batch(
      body.unicodes.map((unicode) => statement.bind(unicode)),
    );
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
      `删除所有字符失败（${(err as Error).message}）`,
    );
  }
  return true;
}
