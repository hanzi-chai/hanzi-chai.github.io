import type { Schema } from "@cfworker/json-schema";
import {
  type EquivalenceData,
  type 字形数据,
  type 字符数据,
  校验字库整数,
  笔画表示方式,
  结构描述字符列表,
} from "hanzi-chai";
import type { 原始汉字模型 } from "../model/repertoire";
import { 定义请求 } from "./request";
import type { User, UserRole, UserState } from "./users";

const 整数: Schema = {
  type: "integer",
  minimum: Number.MIN_SAFE_INTEGER,
  maximum: Number.MAX_SAFE_INTEGER,
};
const 非负整数: Schema = { ...整数, minimum: 0 };
const 字形ID: Schema = { type: "integer", minimum: 0, maximum: 0xfffff };
const Unicode: Schema = { type: "integer", minimum: 0, maximum: 0x10ffff };
const 字符串: Schema = { type: "string" };
const 非空字符串: Schema = { type: "string", minLength: 1 };
const 数组 = (items: Schema): Schema => ({ type: "array", items });
const 对象 = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const 定长数组 = (items: Schema, length: number): Schema => ({
  ...数组(items),
  minItems: length,
  maxItems: length,
});

const 用户字段 = {
  id: { type: "string", pattern: "^[a-zA-Z]([_-]?[a-zA-Z0-9]+)*$" },
  name: { type: "string", pattern: "^.+$" },
  email: {
    type: "string",
    pattern: "^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+([.][a-zA-Z0-9_-]+)+$",
  },
  avatar: 字符串,
  password: 非空字符串,
} satisfies Record<string, Schema>;
type 注册请求 = Pick<User, "id" | "name" | "email"> & {
  password: string;
  avatar?: string;
};
type 更新用户请求 = Partial<注册请求>;

export const 读取注册 = 定义请求<注册请求>(
  对象(用户字段, ["id", "name", "email", "password"]),
);
export const 读取用户更新 = 定义请求<更新用户请求>(对象(用户字段, []));
export const 读取登录 = 定义请求<{ username: string; password: string }>(
  对象({ username: 非空字符串, password: 非空字符串 }),
);
export const 读取角色 = 定义请求<{ role: UserRole }>(
  对象({ role: { enum: [0, 1, 2] } }),
);
export const 读取状态 = 定义请求<{ state: UserState }>(
  对象({ state: { enum: [0, 1] } }),
);

const 字符规则 = 对象(
  {
    unicode: Unicode,
    tygf: { enum: [1, 2, 3] },
    gb2312: { enum: [1, 2] },
    ambiguous: { const: 1 },
    glyphs: 数组(对象({ id: 字形ID, sources: 数组(字符串) })),
  },
  ["unicode", "glyphs"],
);
export const 读取字符 = 定义请求<字符数据>(字符规则, 校验字库整数);
export const 读取字符批量 = 定义请求<字符数据[]>(数组(字符规则), 校验字库整数);
export const 读取字符删除 = 定义请求<{ unicodes: number[] }>(
  对象({ unicodes: 数组(Unicode) }),
);

const 引用规则 = 对象(
  {
    id: 字形ID,
    xbegin: 整数,
    ybegin: 整数,
    xend: 整数,
    yend: 整数,
    attach_to_previous: { type: "boolean" },
  },
  ["id"],
);
const 笔画块规则 = 对象({ index: 非负整数, from: 非负整数, to: 非负整数 }, [
  "index",
]);
const 命令规则: Schema = {
  oneOf: [
    对象({
      command: { enum: ["h", "v", "a"] },
      parameterList: 定长数组(整数, 1),
    }),
    对象({ command: { const: "l" }, parameterList: 定长数组(整数, 2) }),
    对象({ command: { enum: ["c", "z"] }, parameterList: 定长数组(整数, 6) }),
  ],
};
const 笔画规则 = 对象({
  feature: { enum: Object.keys(笔画表示方式) },
  start: 定长数组(整数, 2),
  curveList: 数组(命令规则),
});
const 字形规则: Schema = {
  ...对象(
    {
      id: 字形ID,
      name: 字符串,
      type: { enum: ["component", "compound"] },
      operator: { enum: [...结构描述字符列表] },
      references: 数组(引用规则),
      strokes: 数组({ oneOf: [笔画规则, 笔画块规则] }),
    },
    ["type"],
  ),
  allOf: [
    {
      if: { properties: { type: { const: "compound" } } },
      // biome-ignore lint/suspicious/noThenProperty: JSON Schema 条件关键字
      then: {
        required: ["operator", "references"],
        properties: { strokes: 数组(笔画块规则) },
      },
    },
    {
      if: {
        required: ["operator"],
        properties: { operator: { enum: ["⿲", "⿳"] } },
      },
      // biome-ignore lint/suspicious/noThenProperty: JSON Schema 条件关键字
      then: {
        required: ["references"],
        properties: { references: 定长数组(引用规则, 3) },
      },
      else: {
        if: { required: ["operator"] },
        // biome-ignore lint/suspicious/noThenProperty: JSON Schema 条件关键字
        then: {
          required: ["references"],
          properties: { references: 定长数组(引用规则, 2) },
        },
      },
    },
  ],
};
// 创建由服务端分配 ID；单条更新还须核对路径与请求 ID，批量更新须逐项提供 ID。
export type 字形写入 = Omit<字形数据, "id"> & { id?: number };
export const 读取字形 = 定义请求<字形写入>(字形规则, 校验字库整数);
export const 读取字形批量创建 = 定义请求<字形写入[]>(
  数组(字形规则),
  校验字库整数,
);
export const 读取字形批量更新 = 定义请求<字形数据[]>(
  数组({ ...字形规则, required: ["id", "type"] }),
  校验字库整数,
);
export const 读取字形删除 = 定义请求<{ ids: number[] }>(
  对象({ ids: 数组(字形ID) }),
);
// 保留既有请求字段，兼容共享客户端。
export const 读取替换ID = 定义请求<{ oldId: number; newId: number }>(
  对象({ oldId: 字形ID, newId: 字形ID }),
);

const 旧字库规则 = 对象({
  unicode: Unicode,
  tygf: 非负整数,
  gb2312: 非负整数,
  glyphs: 字符串,
  name: { type: ["string", "null"] },
});
function 校验旧字库(数据: 原始汉字模型): string | undefined {
  try {
    return 校验字库整数(JSON.parse(数据.glyphs));
  } catch {
    return "glyphs 必须是合法 JSON 字符串";
  }
}
export const 读取旧字库 = 定义请求<原始汉字模型>(旧字库规则, 校验旧字库);
export const 读取旧字库批量 = 定义请求<原始汉字模型[]>(
  数组(旧字库规则),
  (数据) => {
    for (const [index, item] of 数据.entries()) {
      const error = 校验旧字库(item);
      if (error) return `/${index}：${error}`;
    }
  },
);
export const 读取旧字库删除 = 定义请求<number[]>(数组(Unicode));
export const 读取PUA创建 = 定义请求<{
  type: "component" | "compound";
  name?: string | null;
}>(
  对象(
    {
      type: { enum: ["component", "compound"] },
      name: { type: ["string", "null"] },
    },
    ["type"],
  ),
);

export const 读取当量 = 定义请求<EquivalenceData>(
  对象({
    user: 字符串,
    model: 字符串,
    data: 数组(
      对象({
        initial: 非负整数,
        final: 非负整数,
        time: { type: "number", minimum: 0 },
      }),
    ),
  }),
);
