import type { 原始汉字模型 } from "../../schema/types";
import { Env } from "../dto/context";
import { Err, ErrCode, Result } from "../error/error";
import { loadNumber, loadString } from "../dto/load";

const table = "repertoire";

export class Model {
  public static async byUnicode(
    env: Env,
    unicode: number,
  ): Promise<Result<原始汉字模型>> {
    let res: 原始汉字模型 | null;
    try {
      res = await env.CHAI.prepare(
        `SELECT * FROM ${table} WHERE unicode=? LIMIT 1`,
      )
        .bind(unicode)
        .first();
    } catch (err) {
      return new Err(ErrCode.DataQueryFailed, "数据查询失败");
    }

    if (res === null) {
      return new Err(ErrCode.RecordNotFound, "字形数据不存在");
    }

    return res;
  }

  public static async generateUnicode(
    env: Env,
    type: string,
  ): Promise<Result<number>> {
    var res: any[];
    const index = type.includes("component") ? 0 : 1;
    const breakpoint = [0xe000, 0xe800, 0xf000] as const;
    const from = breakpoint[index];
    const to = breakpoint[index + 1];
    try {
      const { results } = await env.CHAI.prepare(
        `SELECT unicode FROM ${table} WHERE unicode >= ? AND unicode < ?`,
      )
        .bind(from, to)
        .all();
      res = results;
    } catch (err) {
      return new Err(
        ErrCode.DataQueryFailed,
        `数据查询失败（${(err as Error).message}）`,
      );
    }

    if (res === null) {
      return new Err(ErrCode.RecordNotFound, "字形数据不存在");
    }

    let code = from;
    for (const { unicode } of res) {
      if (unicode !== code) {
        return code;
      }
      code += 1;
    }

    if (code === to) {
      return new Err(ErrCode.UnknownInnerError, "已达上限，无法继续创建");
    }
    return code;
  }

  public static async exist(
    env: Env,
    unicode: number,
  ): Promise<Result<boolean>> {
    var res;
    try {
      res = await env.CHAI.prepare(
        `SELECT COUNT(0) total FROM ${table} WHERE unicode=?`,
      )
        .bind(unicode)
        .first("total");
    } catch (err) {
      return new Err(
        ErrCode.DataQueryFailed,
        `数据查询失败（${(err as Error).message}）`,
      );
    }
    return loadNumber(res) !== 0;
  }

  public static async count(env: Env): Promise<Result<number>> {
    var res;
    try {
      res = await env.CHAI.prepare(`SELECT COUNT(0) total FROM ${table}`).first(
        "total",
      );
    } catch (err) {
      return new Err(
        ErrCode.DataQueryFailed,
        `数据查询失败（${(err as Error).message}）`,
      );
    }
    return loadNumber(res);
  }

  public static async list(
    env: Env,
    offset: number,
    limit: number,
  ): Promise<Result<原始汉字模型[]>> {
    var res;
    try {
      res = await env.CHAI.prepare(`SELECT * FROM ${table} LIMIT ? OFFSET ?`)
        .bind(limit, offset)
        .all();
    } catch (err) {
      return new Err(ErrCode.DataQueryFailed, "数据查询失败");
    }

    const { results } = res;
    return results as unknown as 原始汉字模型[];
  }

  public static async create(
    env: Env,
    character: 原始汉字模型,
  ): Promise<Result<number>> {
    const {
      unicode,
      tygf,
      gb2312,
      glyphs,
      name,
      gf0014_id,
      gf3001_id,
      ambiguous,
    } = character;
    try {
      await env.CHAI.prepare(
        `INSERT INTO ${table} (unicode, tygf, gb2312, glyphs, name, gf0014_id, gf3001_id, ambiguous) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          unicode,
          tygf,
          gb2312,
          glyphs,
          name,
          gf0014_id,
          gf3001_id,
          ambiguous,
        )
        .run();
    } catch (err) {
      return new Err(
        ErrCode.DataCreateFailed,
        `数据创建失败（${(err as Error).message}）`,
      );
    }
    return unicode;
  }

  public static async createBatch(
    env: Env,
    characters: 原始汉字模型[],
  ): Promise<Result<boolean>> {
    try {
      const statement = env.CHAI.prepare(
        `INSERT INTO ${table} (unicode, tygf, gb2312, glyphs, name, gf0014_id, gf3001_id, ambiguous) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      await env.CHAI.batch(
        characters.map((character) => {
          const {
            unicode,
            tygf,
            gb2312,
            glyphs,
            name,
            gf0014_id,
            gf3001_id,
            ambiguous,
          } = character;
          return statement.bind(
            unicode,
            tygf,
            gb2312,
            glyphs,
            name,
            gf0014_id,
            gf3001_id,
            ambiguous,
          );
        }),
      );
    } catch (err) {
      return new Err(
        ErrCode.DataCreateFailed,
        `数据创建失败（${(err as Error).message}）`,
      );
    }
    return true;
  }

  public static async delete(
    env: Env,
    unicode: number,
  ): Promise<Result<boolean>> {
    try {
      await env.CHAI.prepare(`DELETE FROM ${table} WHERE unicode=?`)
        .bind(unicode)
        .run();
    } catch (err) {
      return new Err(
        ErrCode.DataDeleteFailed,
        `数据删除失败（${(err as Error).message}）`,
      );
    }
    return true;
  }

  public static async update(
    env: Env,
    character: 原始汉字模型,
  ): Promise<Result<boolean>> {
    try {
      const {
        unicode,
        tygf,
        gb2312,
        glyphs,
        name,
        gf0014_id,
        gf3001_id,
        ambiguous,
      } = character;
      await env.CHAI.prepare(
        `UPDATE ${table} SET tygf=?, gb2312=?, glyphs=?, name=?, gf0014_id=?, gf3001_id=?, ambiguous=? WHERE unicode=?`,
      )
        .bind(
          tygf,
          gb2312,
          glyphs,
          name,
          gf0014_id,
          gf3001_id,
          ambiguous,
          unicode,
        )
        .run();
    } catch (err) {
      return new Err(
        ErrCode.DataUpdateFailed,
        `数据更新失败（${(err as Error).message}）`,
      );
    }
    return true;
  }

  public static async updateBatch(
    env: Env,
    characters: 原始汉字模型[],
  ): Promise<Result<boolean>> {
    try {
      const statement = env.CHAI.prepare(
        `UPDATE ${table} SET tygf=?, gb2312=?, glyphs=?, name=?, gf0014_id=?, gf3001_id=?, ambiguous=? WHERE unicode=?`,
      );
      await env.CHAI.batch(
        characters.map((character) => {
          const {
            unicode,
            tygf,
            gb2312,
            glyphs,
            name,
            gf0014_id,
            gf3001_id,
            ambiguous,
          } = character;
          return statement.bind(
            tygf,
            gb2312,
            glyphs,
            name,
            gf0014_id,
            gf3001_id,
            ambiguous,
            unicode,
          );
        }),
      );
    } catch (err) {
      return new Err(
        ErrCode.DataUpdateFailed,
        `数据更新失败（${(err as Error).message}）`,
      );
    }
    return true;
  }
}
