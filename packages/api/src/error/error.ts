/** 通用错误结构定义 */
export class Err {
  /** 错误码: `/^[A-Z]{2,5}-[0-9]{8}$/` */
  err: string;
  /** 错误信息 */
  msg: string;

  constructor(code?: string, msg?: string) {
    this.err = code || ErrCode.UnknownInnerError;
    this.msg = msg || "未知内部错误";
  }
}

/** 错误码枚举 */
export enum ErrCode {
  /** 未知错误 */
  UnknownInnerError = "SYS-10000001",

  /** 资源不存在 */
  ResourceNotFound = "RES-10000001",
  /** 参数错误 */
  ParamInvalid = "RES-10000002",

  /** 记录不存在 */
  RecordNotFound = "DB-10000001",
  /** 记录已存在 */
  RecordExists = "DB-10000002",
  /** 数据查询失败 */
  DataQueryFailed = "DB-10000003",
  /** 数据创建失败 */
  DataCreateFailed = "DB-10000004",
  /** 数据删除失败 */
  DataDeleteFailed = "DB-10000005",
  /** 数据更新失败 */
  DataUpdateFailed = "DB-10000006",

  /** 用户JWT无效 */
  Unauthorized = "AUTH-10000001",
  /** 用户权限不足 */
  PermissionDenied = "AUTH-10000002",
}

/** 带有错误的返回值 */
export type Result<T> = T | Err;

/** 判断返回值是否有错误 */
export function Ok<T>(result: Result<T>): result is T {
  return !(result instanceof Err);
}
