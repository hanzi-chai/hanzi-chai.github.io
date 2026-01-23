import type { 原始汉字数据, 字形数据 } from "./lib";

export interface 原始汉字模型 {
  unicode: number;
  tygf: 0 | 1 | 2 | 3;
  gb2312: 0 | 1 | 2;
  glyphs: string;
  name: string | null;
  gf0014_id: number | null;
  gf3001_id: number | null;
  ambiguous: 0 | 1;
}

export const endpoint = "https://api.chaifen.app/";

export interface 后端错误 {
  err: string;
  msg: string;
}

const getHeader = () => {
  const token = globalThis.localStorage ? localStorage.getItem("token") : null;
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : undefined;
};

const template =
  (method: string) =>
  async <R, P>(slug: string, payload?: P) => {
    const response = await fetch(endpoint + slug, {
      method: method,
      headers: getHeader(),
      body: payload && JSON.stringify(payload),
    }).then((res) => res.json());
    return response as R | 后端错误;
  };

export const get = template("GET");
export const post = template("POST");
export const put = template("PUT");
export const del = template("DELETE");

const charToCode = (char: string) => char.codePointAt(0)!;
const codeToChar = (code: number) => String.fromCodePoint(code);

const glyphForward = (c: any) => {
  if (c.type === "basic_component") {
    return c;
  } else if (c.type === "derived_component" || c.type === "identity") {
    return { ...c, source: codeToChar(c.source) };
  } else {
    return { ...c, operandList: c.operandList.map(codeToChar) };
  }
};

const glyphReverse = (c: 字形数据) => {
  if (c.type === "basic_component") {
    return c;
  } else if (c.type === "derived_component" || c.type === "identity") {
    return { ...c, source: charToCode(c.source) };
  } else {
    return { ...c, operandList: c.operandList.map(charToCode) };
  }
};

export function 从模型构建(model: 原始汉字模型): 原始汉字数据 {
  return {
    ...model,
    glyphs: JSON.parse(model.glyphs).map(glyphForward),
    ambiguous: model.ambiguous === 1,
  };
}

export function 转模型(character: 原始汉字数据): 原始汉字模型 {
  return {
    ...character,
    glyphs: JSON.stringify(character.glyphs.map(glyphReverse)),
    ambiguous: +character.ambiguous as 0 | 1,
  };
}

interface PUA {
  type: "component" | "compound";
  name: string;
}

interface DataList<T> {
  total: number;
  page: number;
  size: number;
  items: T[];
}

export const listAll = () =>
  get<原始汉字模型[], undefined>("repertoire/all").then((data) => {
    if ("err" in data) return data;
    return data.map(从模型构建);
  });

export const list = async () => {
  const pages: Promise<DataList<原始汉字模型> | 后端错误>[] = [];
  const results: 原始汉字模型[] = [];
  for (let page = 1; page < 9; ++page) {
    const size = 16384;
    const res = get<DataList<原始汉字模型>, undefined>(
      `repertoire?page=${page}&size=${size}`,
    );
    pages.push(res);
  }
  const data = await Promise.all(pages);
  for (const result of data) {
    if ("err" in result) return result;
    results.push(...result.items);
  }
  return results.map(从模型构建);
};

export const remoteCreateWithoutUnicode = (payload: PUA) =>
  post<number, PUA>("repertoire", payload);

export const remoteCreate = (payload: 原始汉字数据) =>
  post<number, 原始汉字模型>(`repertoire/${payload.unicode}`, 转模型(payload));

export const remoteUpdate = (payload: 原始汉字数据) =>
  put<boolean, 原始汉字模型>(`repertoire/${payload.unicode}`, 转模型(payload));

export const remoteBatchUpdate = (payload: 原始汉字数据[]) =>
  put<boolean, 原始汉字模型[]>(`repertoire/batch`, payload.map(转模型));

export const remoteRemove = (unicode: number) =>
  del<boolean, undefined>(`repertoire/${unicode}`);
