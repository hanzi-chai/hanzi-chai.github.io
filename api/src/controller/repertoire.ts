import type { IRequest } from "itty-router";
import type { Ctx, Env } from "../dto/context";
import {
  读取PUA创建,
  读取旧字库,
  读取旧字库删除,
  读取旧字库批量,
} from "../dto/requests";
import { Err, ErrCode, Ok, type Result } from "../error/error";
import type { 原始汉字模型 } from "../model/repertoire";
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
  const { results } = await env.CHAI.prepare(
    "SELECT unicode, tygf, gb2312, glyphs, name FROM repertoire",
  ).all<原始汉字模型>();
  return results;
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
  const glyph = await 读取旧字库(request);
  if (!Ok(glyph)) return glyph;

  return await Model.create(env, glyph);
}

/** POST:/repertoire/batch */
export async function CreateBatch(
  request: IRequest,
  env: Env,
): Promise<Result<boolean>> {
  const glyph = await 读取旧字库批量(request);
  if (!Ok(glyph)) return glyph;
  return await Model.createBatch(env, glyph);
}

/** POST:/repertoire */
export async function CreatePUA(
  request: IRequest,
  env: Env,
): Promise<Result<number>> {
  const glyph = await 读取PUA创建(request);
  if (!Ok(glyph)) return glyph;

  const unicode = await Model.generateUnicode(env, glyph.type);

  if (!Ok(unicode)) {
    return unicode;
  }
  const model: 原始汉字模型 = {
    unicode,
    tygf: 0,
    gb2312: 0,
    glyphs: "[]",
    name: glyph.name ?? null,
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
  const glyph = await 读取旧字库(request);
  if (!Ok(glyph)) return glyph;

  return await Model.update(env, glyph);
}

/** POST:/repertoire/batch */
export async function UpdateBatch(
  request: IRequest,
  env: Env,
): Promise<Result<boolean>> {
  const glyph = await 读取旧字库批量(request);
  if (!Ok(glyph)) return glyph;
  return await Model.updateBatch(env, glyph);
}

export async function DeleteBatch(
  request: IRequest,
  env: Env,
): Promise<Result<boolean>> {
  const unicodes = await 读取旧字库删除(request);
  if (!Ok(unicodes)) return unicodes;
  const statement = env.CHAI.prepare(`DELETE FROM repertoire WHERE unicode=?`);
  await env.CHAI.batch(unicodes.map((unicode) => statement.bind(unicode)));
  return true;
}
