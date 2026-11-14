import { Router } from "itty-router";
import { Login } from "../controller/users";
import { routerCharacters } from "./characters";
import { routerEquivalence } from "./equivalence";
import { routerGlyphs } from "./glyphs";
import { routerRepertoire } from "./repertoire";
import { routerUsers } from "./users";

/** 主路由, 以 `/api` 为前缀 */
export const routerApi = Router()
  // 登录接口
  .post("/login", Login)
  // 用户子路由
  .all("/users/*", routerUsers.fetch)
  // 汉字信息子路由
  .all("/repertoire/*", routerRepertoire.fetch)
  // 字符子路由
  .all("/characters/*", routerCharacters.fetch)
  // 字形子路由
  .all("/glyphs/*", routerGlyphs.fetch)
  // 当量子路由
  .all("/equivalence/*", routerEquivalence.fetch);
