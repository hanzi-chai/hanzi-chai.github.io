import type { 字形数据 } from "hanzi-chai";
import type { IRequest } from "itty-router";
import type { Env } from "../dto/context";
import { Err, ErrCode } from "../error/error";

const table = "glyphs";

interface 字形模型 extends Pick<字形数据, "id" | "type"> {
  operator: 字形数据["operator"] | null;
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
    references: JSON.stringify(数据.references),
    strokes: JSON.stringify(数据.strokes),
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
