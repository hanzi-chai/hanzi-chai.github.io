import type { IRequest } from "itty-router";
import type { 原始汉字模型 } from "../../scripts/utils";
import type { Ctx, Env } from "../dto/context";
import { DataList } from "../dto/list";
import { loadString } from "../dto/load";
import { Err, ErrCode, Ok, type Result } from "../error/error";
import { Model } from "../model/repertoire";

export async function validateUnicode(request: IRequest, _env: Env, ctx: Ctx) {
  const unicode = parseInt(request.params.unicode, 10);
  if (!Number.isInteger(unicode)) {
    // TODO: 增加具体范围
    return new Err(ErrCode.ParamInvalid, "Unicode不正确");
  }
  ctx.unicode = unicode;
}

export async function checkExist(_request: IRequest, env: Env, ctx: Ctx) {
  // 记录是否已存在
  const exist = await Model.exist(env, ctx.unicode);
  if (!Ok(exist)) {
    return exist;
  }
  if (!exist) {
    return new Err(ErrCode.RecordExists, `${ctx.unicode} 记录不存在`);
  }
}

// 记录是否已存在
export async function checkNotExist(_request: IRequest, env: Env, ctx: Ctx) {
  const exist = await Model.exist(env, ctx.unicode);
  if (!Ok(exist)) {
    return exist;
  }
  if (exist) {
    return new Err(ErrCode.RecordExists, `${ctx.unicode} 记录已存在`);
  }
}

export async function ListAll(_request: Request, env: Env) {
  const { results } = await env.CHAI.prepare("SELECT * FROM repertoire").all();
  return results;
}

/** GET:/repertoire?page=1&size=20 */
export async function List(
  request: IRequest,
  env: Env,
): Promise<Result<DataList<原始汉字模型>>> {
  // 第 `page` 页, 每页 `size` 条
  const { page, size } = request.query;

  // 查询记录总数
  const result = await Model.count(env);
  if (!Ok(result)) {
    return result as Err;
  }

  var list = new DataList<原始汉字模型>();
  list.total = result;
  list.page = parseInt(loadString(page), 10) || 1;
  list.size = parseInt(loadString(size), 10) || 20;

  if (list.total > (list.page - 1) * list.size) {
    // 本页有数据时, 查询数据
    const result = await Model.list(
      env,
      (list.page - 1) * list.size,
      list.size,
    );
    if (!Ok(result)) {
      return result as Err;
    }

    list.items = result;
  }

  return list;
}

/** GET:/repertoire/:unicode */
export async function Info(
  _request: IRequest,
  env: Env,
  ctx: Ctx,
): Promise<Result<原始汉字模型>> {
  const glyphModel = await Model.byUnicode(env, ctx.unicode);
  if (!Ok(glyphModel)) {
    return glyphModel as Err;
  }

  return glyphModel;
}

/** POST:/repertoire/:unicode */
export async function Create(
  request: IRequest,
  env: Env,
): Promise<Result<number>> {
  let glyph: unknown;
  try {
    glyph = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }

  // if (!validateCharacter.validate(glyph)) {
  //   return new Err(ErrCode.ParamInvalid, "请求不合法");
  // }

  return await Model.create(env, glyph as 原始汉字模型);
}

/** POST:/repertoire/batch */
export async function CreateBatch(
  request: IRequest,
  env: Env,
): Promise<Result<boolean>> {
  const glyph: 原始汉字模型[] = await request.json();
  return await Model.createBatch(env, glyph);
}

/** POST:/repertoire */
export async function CreatePUA(
  request: IRequest,
  env: Env,
): Promise<Result<number>> {
  let glyph: any;
  try {
    glyph = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }

  const unicode = await Model.generateUnicode(env, glyph.type);

  if (!Ok(unicode)) {
    return unicode;
  }
  const model: 原始汉字模型 = {
    unicode,
    tygf: 0,
    gb2312: 0,
    glyphs: "[]",
    name: glyph.name,
    gf0014_id: null,
    gf3001_id: null,
    ambiguous: 0,
  };

  return await Model.create(env, model);
}

type Lookup = { unicode: number; glyphs: string };

/** DELETE:/repertoire/:unicode */
export async function Delete(
  _request: IRequest,
  env: Env,
  ctx: Ctx,
): Promise<Result<boolean>> {
  const { results } = await env.CHAI.prepare(
    `SELECT unicode, glyphs FROM repertoire`,
  ).all<Lookup>();
  const regex = new RegExp(`(?<!\\d)${ctx.unicode}(?!\\d)`);
  let hint: Lookup | undefined;
  for (const result of results) {
    if (regex.test(result.glyphs)) {
      hint = result;
      break;
    }
  }
  if (hint !== undefined) {
    return new Err(
      ErrCode.PermissionDenied,
      `无法删除，因为还有 ${hint.unicode} 引用它: ${hint.glyphs}`,
    );
  }
  return await Model.delete(env, ctx.unicode);
}

/** PUT:/repertoire/:unicode */
export async function Update(
  request: IRequest,
  env: Env,
): Promise<Result<boolean>> {
  // 请求参数
  let glyph: unknown;
  try {
    glyph = await request.json();
  } catch (err) {
    return new Err(ErrCode.UnknownInnerError, (err as Error).message);
  }

  // if (!validateCharacter.validate(glyph)) {
  //   return new Err(ErrCode.ParamInvalid, "请求不合法");
  // }

  return await Model.update(env, glyph as 原始汉字模型);
}

/** POST:/repertoire/batch */
export async function UpdateBatch(
  request: IRequest,
  env: Env,
): Promise<Result<boolean>> {
  const glyph: 原始汉字模型[] = await request.json();
  return await Model.updateBatch(env, glyph);
}

export async function DeleteBatch(
  request: IRequest,
  env: Env,
): Promise<Result<boolean>> {
  const unicodes: number[] = await request.json();
  const statement = env.CHAI.prepare(`DELETE FROM repertoire WHERE unicode=?`);
  await env.CHAI.batch(unicodes.map((unicode) => statement.bind(unicode)));
  return true;
}
