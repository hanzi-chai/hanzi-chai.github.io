import { error, type IRequest } from "itty-router";
import type { Ctx, Env } from "../dto/context";
import { Claims } from "../dto/jwt";
import { UserRole } from "../dto/users";
import { Err, ErrCode, Ok, type Result } from "../error/error";
import { UserModel } from "../model/users";

async function parseJwt(token: string, env: Env): Promise<Result<Claims>> {
  const claims = await Claims.parse(token, env);
  if (!Ok(claims)) {
    return new Err(ErrCode.Unauthorized, "用户身份凭证无效");
  }
  // 校验通过, 返回用户ID
  return claims;
}

/** 身份认证中间件 */
export async function authorizedUser(
  request: IRequest,
  env: Env,
  ctx: Ctx,
): Promise<any> {
  // 从请求头提取 jwt
  const token = request.headers.get("Authorization");
  if (token === null) {
    return error(401, new Err(ErrCode.Unauthorized, "需要身份认证"));
  }

  // 校验 jwt
  const claims = await parseJwt(token.replace(/^Bearer /, ""), env);
  if (!Ok(claims)) {
    return error(401, claims as Err);
  }

  // 向上下文中注入用户ID
  ctx.UserId = claims.uid;

  if (claims.needRefresh()) {
    // 将新的 token 写入到 NewToken 响应头
    const newToken = await claims.sign(env);
    ctx.extraHeaders.set("New-Token", newToken);
  }

  return;
}

/** 管理员身份认证. **注意**: 必须有前置身份认证 */
export async function authorizedAdmin(
  request: IRequest,
  env: Env,
  ctx: Ctx,
): Promise<any> {
  // 从上下文中取出用户ID, 并验证管理员身份
  const userModel = await UserModel.byId(env, ctx.UserId);
  if (!Ok(userModel) || userModel.role === UserRole.Normal) {
    return error(403, new Err(ErrCode.PermissionDenied, "权限不足"));
  }

  return;
}

/** 超级管理员身份认证. **注意**: 必须有前置身份认证 */
export async function authorizedSuper(
  request: IRequest,
  env: Env,
  ctx: Ctx,
): Promise<any> {
  // 从上下文中取出用户ID, 并验证管理员身份
  const userModel = await UserModel.byId(env, ctx.UserId);
  if (!Ok(userModel) || userModel.role !== UserRole.Super) {
    return error(403, new Err(ErrCode.PermissionDenied, "权限不足"));
  }

  return;
}
