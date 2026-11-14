import type { IRequest } from "itty-router";
import type { Ctx, Env } from "../dto/context";
import { Claims } from "../dto/jwt";
import {
  读取注册,
  读取状态,
  读取用户更新,
  读取登录,
  读取角色,
} from "../dto/requests";
import { User, UserLogin, UserRole, UserState } from "../dto/users";
import { Err, ErrCode, Ok, type Result } from "../error/error";
import { authorizedAdmin } from "../middleware/jwt";
import { UserModel } from "../model/users";

function userFromModel(userModel: UserModel): User {
  var user = new User();
  user.id = userModel.id;
  user.name = userModel.name;
  user.email = userModel.email;
  user.avatar = userModel.avatar;
  user.role = userModel.role;
  user.state = userModel.state;
  return user;
}

/** 输入 -> SHA1 -> Base64 -> 输出 */
async function hashPassword(password: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(password),
  );
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/** 将给定的密码与库中记录比对 */
async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

/** GET:/users/:id */
export async function Info(request: IRequest, env: Env): Promise<Result<User>> {
  const userId = request.params.id;

  // 从 `model` 层取回数据
  const result = await UserModel.byId(env, userId);
  if (!Ok(result)) {
    // 返回错误
    return result as Err;
  }

  // 返回用户信息
  return userFromModel(result);
}

/** POST:/users */
export async function Create(
  request: IRequest,
  env: Env,
): Promise<Result<boolean>> {
  const args = await 读取注册(request);
  if (!Ok(args)) return args;
  const userModel: UserModel = {
    id: args.id,
    name: args.name,
    email: args.email,
    avatar: args.avatar ?? "",
    password: await hashPassword(args.password),
    role: UserRole.Normal,
    state: UserState.Normal,
  };

  // 用户名或邮箱是否已存在
  var exist = await UserModel.exist(env, userModel.id, userModel.email);
  if (!Ok(exist)) {
    return exist as Err;
  }
  if (exist) {
    return new Err(ErrCode.RecordExists, "用户已存在");
  }

  // 创建用户
  const result = await UserModel.create(env, userModel);
  if (!Ok(result)) {
    return result as Err;
  }

  // 首位注册用户, 赋予超级管理员身份
  const userCount = await UserModel.count(env);
  if (Ok(userCount) && userCount === 1) {
    await UserModel.promote(env, userModel.id, UserRole.Super);
  }

  return result;
}

/** DELETE:/users/:id */
export async function Delete(
  request: IRequest,
  env: Env,
): Promise<Result<boolean>> {
  const userId = request.params.id;
  if (!userId) {
    return new Err(ErrCode.ParamInvalid, "用户名不正确");
  }

  const userModel = await UserModel.byId(env, userId);
  if (!Ok(userModel)) {
    return userModel as Err;
  }

  return await UserModel.delete(env, userId);
}

/** PUT:/users/:id */
export async function Update(
  request: IRequest,
  env: Env,
  ctx: Ctx,
): Promise<Result<boolean>> {
  const userId = request.params.id;
  if (!userId) {
    return new Err(ErrCode.ParamInvalid, "用户名不正确");
  }

  if (userId !== ctx.UserId) {
    // 修改他人信息, 要求管理员
    const auth = await authorizedAdmin(request, env, ctx);
    if (!Ok(auth)) {
      return auth as Err;
    }
  }

  // 用户存在
  const userModel = await UserModel.byId(env, userId);
  if (!Ok(userModel)) {
    return userModel as Err;
  }

  const args = await 读取用户更新(request);
  if (!Ok(args)) return args;
  if (args.id !== undefined && args.id !== userId)
    return new Err(ErrCode.ParamInvalid, "不可修改用户 ID");

  const newModel: UserModel = {
    ...userModel,
    name: args.name ?? userModel.name,
    email: args.email ?? userModel.email,
    avatar: args.avatar ?? userModel.avatar,
    password:
      args.password === undefined
        ? userModel.password
        : await hashPassword(args.password),
  };
  return await UserModel.update(env, newModel);
}

/** PUT:/users/:id/promote */
export async function Promote(
  request: IRequest,
  env: Env,
  ctx: Ctx,
): Promise<Result<boolean>> {
  const userId = request.params.id;
  if (!userId) {
    return new Err(ErrCode.ParamInvalid, "用户名不正确");
  }
  if (userId === ctx.UserId) {
    return new Err(ErrCode.ParamInvalid, "不可修改当前登录用户");
  }

  const args = await 读取角色(request);
  if (!Ok(args)) return args;
  return await UserModel.promote(env, userId, args.role);
}

/** PUT:/users/:id/disable */
export async function Disable(
  request: IRequest,
  env: Env,
  ctx: Ctx,
): Promise<Result<boolean>> {
  const userId = request.params.id;
  if (!userId) {
    return new Err(ErrCode.ParamInvalid, "用户名不正确");
  }
  if (userId === ctx.UserId) {
    return new Err(ErrCode.ParamInvalid, "不可修改当前登录用户");
  }

  const args = await 读取状态(request);
  if (!Ok(args)) return args;
  return await UserModel.disable(env, userId, args.state);
}

/** POST:/login */
export async function Login(
  request: IRequest,
  env: Env,
): Promise<Result<UserLogin>> {
  const args = await 读取登录(request);
  if (!Ok(args)) return args;
  const { username, password } = args;

  let userModel: Result<UserModel>;
  if (username.match(/@/)) {
    // 通过邮箱登录
    userModel = await UserModel.byEmail(env, username);
  } else {
    // 通过用户名登录
    userModel = await UserModel.byId(env, username);
  }
  if (!Ok(userModel)) {
    return userModel as Err;
  }

  // 用户被停用, 禁止登录
  if (userModel.state === UserState.Disabled) {
    return new Err(ErrCode.PermissionDenied, "用户已停用");
  }

  if (await verifyPassword(password, userModel.password)) {
    // 密码正确
    const user = userFromModel(userModel);
    const token = await Claims.new(user.id).sign(env);
    // 返回用户信息和 jwt
    return new UserLogin(user, token);
  } else {
    return new Err(ErrCode.ParamInvalid, "用户名或密码错误");
  }
}
