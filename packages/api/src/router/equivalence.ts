import { IRequest, Router } from "itty-router";
import { authorizedUser } from "../middleware/jwt";
import { Env } from "../dto/context";
import { Err, ErrCode, Result } from "../error/error";

const tableEquivalence = "equivalence";

async function List(request: IRequest, env: Env) {
  const { results } = await env.CHAI.prepare(
    `SELECT * FROM ${tableEquivalence}`,
  ).all();
  const data = results.map((row) => {
    return {
      user: row.user,
      model: row.model,
      data: JSON.parse(row.data as string),
    };
  });
  return data;
}

async function Create(request: IRequest, env: Env): Promise<Result<boolean>> {
  let success = false;
  try {
    let user, model, data;
    const body = await request.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "user" in body &&
      "model" in body &&
      "data" in body
    ) {
      user = body.user;
      model = body.model;
      data = body.data;
    }
    const res = await env.CHAI.prepare(
      `INSERT INTO ${tableEquivalence} (user, model, data) VALUES (?, ?, ?)`,
    )
      .bind(user, model, JSON.stringify(data))
      .run();
    success = res.error === undefined;
  } catch (e) {
    return new Err(ErrCode.DataCreateFailed, "上传失败");
  }
  return success;
}

export const routerEquivalence = Router({ base: "/equivalence" })
  .get("/", List)
  .post("/", authorizedUser, Create);
