/**
 * 共享的 API 客户端工厂函数。
 * 前端（src/api.ts）和脚本（packages/api/scripts/utils.ts）共用，
 * 仅 token 来源不同（localStorage vs process.env.JWT）。
 */

export const endpoint = "https://api.chaifen.app";

export interface 后端错误 {
  err: string;
  msg: string;
}

type TokenProvider = () => string | null;

export function createClient(getToken: TokenProvider) {
  async function request<R>(
    method: string,
    slug: string,
    payload?: unknown,
  ): Promise<R | 后端错误> {
    const token = getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const init: RequestInit = { method, headers };
    if (payload !== undefined && method !== "GET") {
      init.body = JSON.stringify(payload);
    }
    const res = await fetch(endpoint + slug, init);
    return res.json() as Promise<R | 后端错误>;
  }

  return {
    get: <R>(slug: string) => request<R>("GET", slug),
    post: <R>(slug: string, payload?: unknown) => request<R>("POST", slug, payload),
    put: <R>(slug: string, payload?: unknown) => request<R>("PUT", slug, payload),
    del: <R>(slug: string, payload?: unknown) => request<R>("DELETE", slug, payload),
  };
}