import { type Schema, Validator } from "@cfworker/json-schema";
import { Err, ErrCode, type Result } from "../error/error";

/** 在模块初始化时创建校验器；只有通过 Schema 和领域校验的数据才能进入业务层。 */
export function 定义请求<T>(
  schema: Schema,
  校验?: (数据: T) => string | undefined,
) {
  const validator = new Validator(schema, "2020-12");
  return async (request: Request): Promise<Result<T>> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Err(ErrCode.ParamInvalid, "请求体必须是合法 JSON");
    }
    const result = validator.validate(body);
    if (!result.valid) {
      const error = result.errors[result.errors.length - 1]!;
      return new Err(
        ErrCode.ParamInvalid,
        `请求参数 ${error.instanceLocation || "/"}：${error.error}`,
      );
    }
    // Schema 与 T 在请求定义处配对，类型断言集中在此边界。
    const data = body as T;
    const error = 校验?.(data);
    return error ? new Err(ErrCode.ParamInvalid, error) : data;
  };
}
