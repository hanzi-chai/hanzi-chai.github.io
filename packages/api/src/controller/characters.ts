import type { 字符数据 } from "hanzi-chai";
import type { IRequest } from "itty-router";
import type { Env } from "../dto/context";
import { Err, ErrCode } from "../error/error";

const table = "characters";

interface 字符模型 extends Pick<字符数据, "unicode"> {
  tygf: 1 | 2 | 3 | null;
  gb2312: 1 | 2 | null;
  ambiguous: 1 | null;
  name: string | null;
  glyphs: string; // JSON 字符串
}

function 转数据(数据: 字符模型): 字符数据 {
  return {
    ...数据,
    tygf: 数据.tygf ?? undefined,
    gb2312: 数据.gb2312 ?? undefined,
    ambiguous: 数据.ambiguous ?? undefined,
    name: 数据.name ?? undefined,
    glyphs: JSON.parse(数据.glyphs) as 字符数据["glyphs"],
  };
}

function 转模型(数据: 字符数据): 字符模型 {
  return {
    ...数据,
    tygf: 数据.tygf ?? null,
    gb2312: 数据.gb2312 ?? null,
    ambiguous: 数据.ambiguous ?? null,
    name: 数据.name ?? null,
    glyphs: JSON.stringify(数据.glyphs),
  };
}

/** GET:/characters */
export async function List(_request: Request, env: Env) {
  const { results } = await env.CHAI.prepare(
    `SELECT * FROM ${table}`,
  ).all<字符模型>();
  return results.map(转数据);
}

/** GET:/characters/:unicode */
export async function Info(request: IRequest, env: Env) {
  const unicode = parseInt(request.params.unicode, 10);
  if (!Number.isInteger(unicode))
    return new Err(ErrCode.ParamInvalid, "Unicode不正确");
  const res = await env.CHAI.prepare(`SELECT * FROM ${table} WHERE unicode=?`)
    .bind(unicode)
    .first<字符模型>();
  if (!res) return new Err(ErrCode.RecordNotFound, "字符不存在");
  return 转数据(res);
}

/** POST:/characters */
export async function Create(request: IRequest, env: Env) {
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  const { unicode, tygf, gb2312, glyphs, name, ambiguous } = 转模型(body);
  try {
    await env.CHAI.prepare(
      `INSERT INTO ${table} (unicode, tygf, gb2312, glyphs, name, ambiguous) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(unicode, tygf, gb2312, glyphs, name, ambiguous)
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
      body.map((item: any) => {
        const { unicode, tygf, gb2312, glyphs, name, ambiguous } = 转模型(item);
        return statement.bind(unicode, tygf, gb2312, glyphs, name, ambiguous);
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

  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }
  const { tygf, gb2312, glyphs, name, ambiguous } = 转模型(body);
  try {
    await env.CHAI.prepare(
      `UPDATE ${table} SET tygf=?, gb2312=?, glyphs=?, name=?, ambiguous=? WHERE unicode=?`,
    )
      .bind(tygf, gb2312, glyphs, name, ambiguous, unicode)
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
