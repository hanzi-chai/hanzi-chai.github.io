import type { Env } from "../dto/context";
import { Err, ErrCode, type Result } from "../error/error";

const tableUsers = "users";

export class UserModel {
  id: string = "";
  name: string = "";
  email: string = "";
  password: string = "";
  avatar: string = "";
  role: number = 0;
  state: number = 0;

  public static async byId(env: Env, id: string): Promise<Result<UserModel>> {
    let res: UserModel | null;
    try {
      res = await env.CHAI.prepare(
        `SELECT * FROM ${tableUsers} WHERE id=? LIMIT 1`,
      )
        .bind(id)
        .first<UserModel>();
    } catch (err) {
      console.warn({ message: (err as Error).message });
      return new Err(ErrCode.DataQueryFailed, "数据查询失败");
    }

    if (res === null) {
      return new Err(ErrCode.RecordNotFound, "用户不存在");
    }

    return res;
  }

  public static async byEmail(
    env: Env,
    email: string,
  ): Promise<Result<UserModel>> {
    let res: UserModel | null;
    try {
      res = await env.CHAI.prepare(
        `SELECT * FROM ${tableUsers} WHERE email=? LIMIT 1`,
      )
        .bind(email)
        .first<UserModel>();
    } catch (err) {
      console.warn({ message: (err as Error).message });
      return new Err(ErrCode.DataQueryFailed, "数据查询失败");
    }

    if (res === null) {
      return new Err(ErrCode.RecordNotFound, "用户不存在");
    }

    return res;
  }

  /** 指定ID或邮箱的用户是否存在 */
  public static async exist(
    env: Env,
    id: string,
    email: string,
  ): Promise<Result<boolean>> {
    let res: number | null;
    try {
      res = await env.CHAI.prepare(
        `SELECT COUNT(0) total FROM ${tableUsers} WHERE id=? OR email=?`,
      )
        .bind(id, email)
        .first<number>("total");
    } catch (err) {
      console.warn({ message: (err as Error).message });
      return new Err(ErrCode.DataQueryFailed, "数据查询失败");
    }
    return (res ?? 0) !== 0;
  }

  public static async count(env: Env): Promise<Result<number>> {
    let res: number | null;
    try {
      res = await env.CHAI.prepare(
        `SELECT COUNT(0) total FROM ${tableUsers}`,
      ).first<number>("total");
    } catch (err) {
      console.warn({ message: (err as Error).message });
      return new Err(ErrCode.DataQueryFailed, "数据查询失败");
    }
    return res ?? 0;
  }

  public static async create(
    env: Env,
    user: UserModel,
  ): Promise<Result<boolean>> {
    try {
      await env.CHAI.prepare(
        `INSERT INTO ${tableUsers} (id, name, email, avatar, password) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(user.id, user.name, user.email, user.avatar, user.password)
        .run();
    } catch (err) {
      console.warn({ message: (err as Error).message });
      return new Err(ErrCode.DataCreateFailed, "数据创建失败");
    }
    return true;
  }

  public static async delete(env: Env, id: string): Promise<Result<boolean>> {
    try {
      await env.CHAI.prepare(`DELETE FROM ${tableUsers} WHERE id=?`)
        .bind(id)
        .run();
    } catch (err) {
      console.warn({ message: (err as Error).message });
      return new Err(ErrCode.DataDeleteFailed, "数据删除失败");
    }
    return true;
  }

  public static async update(
    env: Env,
    user: UserModel,
  ): Promise<Result<boolean>> {
    try {
      await env.CHAI.prepare(
        `UPDATE ${tableUsers} SET name=?, email=?, avatar=?, password=? WHERE id=?`,
      )
        .bind(user.name, user.email, user.avatar, user.password, user.id)
        .run();
    } catch (err) {
      console.warn({ message: (err as Error).message });
      return new Err(ErrCode.DataUpdateFailed, "数据更新失败");
    }
    return true;
  }

  /** 修改用户管理员级别 */
  public static async promote(
    env: Env,
    id: string,
    role: number,
  ): Promise<Result<boolean>> {
    try {
      await env.CHAI.prepare(`UPDATE ${tableUsers} SET role=? WHERE id=?`)
        .bind(role, id)
        .run();
    } catch (err) {
      console.warn({ message: (err as Error).message });
      return new Err(ErrCode.DataUpdateFailed, "数据更新失败");
    }
    return true;
  }

  /** 修改用户停用状态 */
  public static async disable(
    env: Env,
    id: string,
    state: number,
  ): Promise<Result<boolean>> {
    try {
      await env.CHAI.prepare(`UPDATE ${tableUsers} SET state=? WHERE id=?`)
        .bind(state, id)
        .run();
    } catch (err) {
      console.warn({ message: (err as Error).message });
      return new Err(ErrCode.DataUpdateFailed, "数据更新失败");
    }
    return true;
  }
}
