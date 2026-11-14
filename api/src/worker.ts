import { error, json, Router } from "itty-router";
import { cors } from "itty-router/cors";
import type { Ctx, Env } from "./dto/context";
import { Err, ErrCode } from "./error/error";
import { routerApi } from "./router/router";

const { preflight, corsify } = cors({
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});

const router = Router()
  .all("*", preflight)
  // 主路由
  .all("*", routerApi.fetch)
  // fallback
  .all("*", () => error(404, new Err(ErrCode.ResourceNotFound, "资源不存在")));

/*
# 目录结构

- `src`
  - `router`: 所有路由定义
  - `def`: 全局常量定义
  - `dto`: 所有交互数据类型定义
  - `error`: 错误类型定义和枚举
  - `controller`: 所有请求处理逻辑
  - `model`: 所有数据库操作接口
  - `utils`: 一些通用的工具函数
*/

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    // 附加 Response Headers
    ctx.extraHeaders = new Headers();

    return await router
      .fetch(request, env, ctx)
      .then(json)
      .then((response: Response) => {
        // 注入附加响应头
        for (const [key, value] of ctx.extraHeaders.entries()) {
          response.headers.set(key, value);
        }
        return response;
      })
      .then(corsify);
  },
};
