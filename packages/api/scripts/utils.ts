import type { 原始汉字数据, 字形描述 } from "hanzi-chai";
import axios from "axios";
import "dotenv/config";
import type {
  旧笔画数据,
  旧基本部件数据,
  旧笔画块,
  旧复合体参数,
  结构描述字符,
} from "hanzi-chai";


export function listToObject<T extends { unicode: number }>(list: T[]) {
  return Object.fromEntries(
    list.map((x) => [String.fromCodePoint(x.unicode), x]),
  );
}

const charToCode = (char: string) => char.codePointAt(0)!;

const glyphReverse = (c: 字形描述) => {
  if (c.type === "basic_component") {
    return c;
  } else if (c.type === "derived_component" || c.type === "identity") {
    return { ...c, source: charToCode(c.source as any) };
  } else {
    return { ...c, operandList: c.operandList.map(charToCode as any) };
  }
};

export function toModel(character: 原始汉字数据) {
  return {
    ...character,
    glyphs: JSON.stringify(character.glyphs.map(glyphReverse)),
    ambiguous: +character.ambiguous as 0 | 1,
  };
}

const endpoint = "https://api.chaifen.app";
const headers = {
  Authorization: `Bearer ${process.env.JWT}`,
};

export async function put<T>(route: string, data: T) {
  const result = await axios.put(endpoint + route, data, { headers });
  console.log(result.data);
}

export async function post<T>(route: string, data: T) {
  const result = await axios.post(endpoint + route, data, { headers });
  console.log(result.data);
}

export async function del<T>(route: string, data: T) {
  const result = await axios.delete(endpoint + route, { headers, data });
  console.log(result.data);
}

export interface 旧衍生部件模型 {
  type: "derived_component";
  tags?: string[];
  source: number;
  strokes: 旧笔画数据[];
}

export interface 旧拼接部件模型 {
  type: "spliced_component";
  operator: 结构描述字符;
  operandList: number[];
  tags?: string[];
  order?: 旧笔画块[];
  parameters?: 旧复合体参数;
}

export interface 旧复合体模型 {
  type: "compound";
  operator: 结构描述字符;
  operandList: number[];
  tags?: string[];
  order?: 旧笔画块[];
  parameters?: 旧复合体参数;
}

export interface 旧全等模型 {
  type: "identity";
  tags?: string[];
  source: number;
}

export type 旧字形数据模型 = 旧基本部件数据
  | 旧衍生部件模型
  | 旧拼接部件模型 | 旧复合体模型 | 旧全等模型;

export interface 原始命名汉字数据 extends Omit<原始汉字数据, "unicode"> {
  name: string;
}

export interface 原始汉字模型 {
  unicode: number;
  tygf: 0 | 1 | 2 | 3;
  gb2312: 0 | 1 | 2;
  glyphs: string; // JSON 字符串
  name: string | null;
  gf0014_id: number | null;
  gf3001_id: number | null;
  ambiguous: 0 | 1;
}
