/**
 * 上下文环境
 * CHAI: 数据库访问对象, 这应该只在 `data` 层使用
 */
export interface Env {
  CHAI: D1Database;
  REFERENCE: KVNamespace;
  JWT_KEY: string;
}

/**
 * 请求上下文
 * 参见 [Fetch Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
 * UserId: 当前用户 ID, 由鉴权中间件注入
 */
export interface Ctx extends ExecutionContext {
  UserId: string;
  unicode: number;
  extraHeaders: Headers;
}
