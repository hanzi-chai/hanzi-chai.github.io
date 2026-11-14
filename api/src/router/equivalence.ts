import type { EquivalenceData } from "hanzi-chai";
import { type IRequest, Router } from "itty-router";
import type { Env } from "../dto/context";
import { 读取当量 } from "../dto/requests";
import { Err, ErrCode, Ok, type Result } from "../error/error";
import { authorizedUser } from "../middleware/jwt";

const tableEquivalence = "equivalence";
type 当量模型 = Omit<EquivalenceData, "data"> & { data: string };

async function List(_request: IRequest, env: Env) {
  const { results } = await env.CHAI.prepare(
    `SELECT user, model, data FROM ${tableEquivalence}`,
  ).all<当量模型>();
  return results.map(
    (row): EquivalenceData => ({
      user: row.user,
      model: row.model,
      data: JSON.parse(row.data) as EquivalenceData["data"],
    }),
  );
}

async function Create(request: IRequest, env: Env): Promise<Result<boolean>> {
  const body = await 读取当量(request);
  if (!Ok(body)) return body;
  try {
    const res = await env.CHAI.prepare(
      `INSERT INTO ${tableEquivalence} (user, model, data) VALUES (?, ?, ?)`,
    )
      .bind(body.user, body.model, JSON.stringify(body.data))
      .run();
    return res.error === undefined;
  } catch {
    return new Err(ErrCode.DataCreateFailed, "上传失败");
  }
}

export const routerEquivalence = Router({ base: "/equivalence" })
  .get("/", List)
  .post("/", authorizedUser, Create);
