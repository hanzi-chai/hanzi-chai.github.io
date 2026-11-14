import type { Env } from "../dto/context";
import { Err, ErrCode, type Result } from "../error/error";

export interface 原始汉字模型 {
  unicode: number;
  tygf: number;
  gb2312: number;
  glyphs: string;
  name: string | null;
}

const table = "repertoire";

export const Model = {
  async byUnicode(env: Env, unicode: number): Promise<Result<原始汉字模型>> {
    let res: 原始汉字模型 | null;
    try {
      res = await env.CHAI.prepare(
        `SELECT unicode, tygf, gb2312, glyphs, name FROM ${table} WHERE unicode=? LIMIT 1`,
      )
        .bind(unicode)
        .first<原始汉字模型>();
    } catch (_err) {
      return new Err(ErrCode.DataQueryFailed, "数据查询失败");
    }

    if (res === null) {
      return new Err(ErrCode.RecordNotFound, "字形数据不存在");
    }

    return res;
  },

  async generateUnicode(env: Env, type: string): Promise<Result<number>> {
    let res: { unicode: number }[];
    const index = type.includes("component") ? 0 : 1;
    const breakpoint = [0xe000, 0xe800, 0xf000] as const;
    const from = breakpoint[index];
    const to = breakpoint[index + 1];
    try {
      const { results } = await env.CHAI.prepare(
        `SELECT unicode FROM ${table} WHERE unicode >= ? AND unicode < ?`,
      )
        .bind(from, to)
        .all<{ unicode: number }>();
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
  },

  async exist(env: Env, unicode: number): Promise<Result<boolean>> {
    let res: number | null;
    try {
      res = await env.CHAI.prepare(
        `SELECT COUNT(0) total FROM ${table} WHERE unicode=?`,
      )
        .bind(unicode)
        .first<number>("total");
    } catch (err) {
      return new Err(
        ErrCode.DataQueryFailed,
        `数据查询失败（${(err as Error).message}）`,
      );
    }
    return (res ?? 0) !== 0;
  },

  async create(env: Env, character: 原始汉字模型): Promise<Result<number>> {
    const { unicode, tygf, gb2312, glyphs, name } = character;
    try {
      await env.CHAI.prepare(
        `INSERT INTO ${table} (unicode, tygf, gb2312, glyphs, name) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(unicode, tygf, gb2312, glyphs, name)
        .run();
    } catch (err) {
      return new Err(
        ErrCode.DataCreateFailed,
        `数据创建失败（${(err as Error).message}）`,
      );
    }
    return unicode;
  },

  async createBatch(
    env: Env,
    characters: 原始汉字模型[],
  ): Promise<Result<boolean>> {
    try {
      const statement = env.CHAI.prepare(
        `INSERT INTO ${table} (unicode, tygf, gb2312, glyphs, name) VALUES (?, ?, ?, ?, ?)`,
      );
      await env.CHAI.batch(
        characters.map((character) => {
          const { unicode, tygf, gb2312, glyphs, name } = character;
          return statement.bind(unicode, tygf, gb2312, glyphs, name);
        }),
      );
    } catch (err) {
      return new Err(
        ErrCode.DataCreateFailed,
        `数据创建失败（${(err as Error).message}）`,
      );
    }
    return true;
  },

  async delete(env: Env, unicode: number): Promise<Result<boolean>> {
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
  },

  async update(env: Env, character: 原始汉字模型): Promise<Result<boolean>> {
    try {
      const { unicode, tygf, gb2312, glyphs, name } = character;
      await env.CHAI.prepare(
        `UPDATE ${table} SET tygf=?, gb2312=?, glyphs=?, name=? WHERE unicode=?`,
      )
        .bind(tygf, gb2312, glyphs, name, unicode)
        .run();
    } catch (err) {
      return new Err(
        ErrCode.DataUpdateFailed,
        `数据更新失败（${(err as Error).message}）`,
      );
    }
    return true;
  },

  async updateBatch(
    env: Env,
    characters: 原始汉字模型[],
  ): Promise<Result<boolean>> {
    try {
      const statement = env.CHAI.prepare(
        `UPDATE ${table} SET tygf=?, gb2312=?, glyphs=?, name=? WHERE unicode=?`,
      );
      await env.CHAI.batch(
        characters.map((character) => {
          const { unicode, tygf, gb2312, glyphs, name } = character;
          return statement.bind(tygf, gb2312, glyphs, name, unicode);
        }),
      );
    } catch (err) {
      return new Err(
        ErrCode.DataUpdateFailed,
        `数据更新失败（${(err as Error).message}）`,
      );
    }
    return true;
  },
};
