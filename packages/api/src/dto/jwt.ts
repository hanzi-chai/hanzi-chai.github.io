import { decode, sign, verify } from "@tsndr/cloudflare-worker-jwt";
import { Err, ErrCode, type Result } from "../error/error";
import { random } from "../utils/random";
import { nowUnix, UnixDay, UnixHour } from "../utils/time";
import type { Env } from "./context";

/** JWT 有效期, 默认一周 */
const JwtExpires = 7 * UnixDay;
/** JWT 刷新时间, 默认一小时 */
const JwtRefresh = 1 * UnixHour;
/** JWT 签名密钥: 应该出现在非公开配置文件中 */
/** JWT 签名公钥: 应该出现在配置文件中 */

export class Claims {
  jti: string = "";
  iat: number = 0;
  exp: number = 0;
  uid: string = "";

  public async sign(env: Env): Promise<string> {
    return await sign(this, env.JWT_KEY);
  }

  public needRefresh(): boolean {
    return nowUnix() - this.iat > JwtRefresh;
  }

  public static new(userId: string, expires?: number): Claims {
    var claims = new Claims();
    claims.jti = Math.round(random(0, 0xffffffff)).toString();
    claims.iat = nowUnix();
    claims.exp = claims.iat + (expires || JwtExpires);
    claims.uid = userId;
    return claims;
  }

  public static async parse(
    token: string,
    env: Env,
    key?: string,
  ): Promise<Result<Claims>> {
    try {
      if (!(await verify(token, key || env.JWT_KEY))) {
        return new Err(ErrCode.Unauthorized, "invalid token");
      }
    } catch (err) {
      return new Err(ErrCode.Unauthorized, "invalid token");
    }

    const { payload } = decode<{ uid: string }>(token);
    if (!payload) return new Err(ErrCode.Unauthorized, "invalid token");
    var claims = new Claims();
    claims.jti = payload.jti || "";
    claims.iat = payload.iat || 0;
    claims.exp = payload.exp || 0;
    claims.uid = payload.uid || "";
    return claims;
  }
}
