import type {
  Component,
  Compound,
  Identity,
  PrimitiveCharacter,
} from "./lib";

interface Model {
  unicode: number;
  tygf: 0 | 1 | 2 | 3;
  gb2312: 0 | 1 | 2;
  readings: string;
  glyphs: string;
  name: string | null;
  gf0014_id: number | null;
  gf3001_id: number | null;
  ambiguous: 0 | 1;
}

export const endpoint = "https://api.chaifen.app/";

export interface Err {
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
    return response as R | Err;
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

const glyphReverse = (c: Component | Compound | Identity) => {
  if (c.type === "basic_component") {
    return c;
  } else if (c.type === "derived_component" || c.type === "identity") {
    return { ...c, source: charToCode(c.source) };
  } else {
    return { ...c, operandList: c.operandList.map(charToCode) };
  }
};

export function fromModel(model: Model): PrimitiveCharacter {
  return {
    ...model,
    readings: JSON.parse(model.readings),
    glyphs: JSON.parse(model.glyphs).map(glyphForward),
    ambiguous: model.ambiguous === 1,
  };
}

export function toModel(character: PrimitiveCharacter): Model {
  return {
    ...character,
    readings: JSON.stringify(character.readings),
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
  get<Model[], undefined>("repertoire/all").then((data) => {
    if ("err" in data) return data;
    return data.map(fromModel);
  });

export const list = async () => {
  const pages: Promise<DataList<Model> | Err>[] = [];
  const results: Model[] = [];
  for (let page = 1; page < 9; ++page) {
    const size = 16384;
    const res = get<DataList<Model>, undefined>(
      `repertoire?page=${page}&size=${size}`,
    );
    pages.push(res);
  }
  const data = await Promise.all(pages);
  for (const result of data) {
    if ("err" in result) return result;
    results.push(...result.items);
  }
  return results.map(fromModel);
};

export const remoteCreateWithoutUnicode = (payload: PUA) =>
  post<number, PUA>("repertoire", payload);

export const remoteCreate = (payload: PrimitiveCharacter) =>
  post<number, Model>(`repertoire/${payload.unicode}`, toModel(payload));

export const remoteUpdate = (payload: PrimitiveCharacter) =>
  put<boolean, Model>(`repertoire/${payload.unicode}`, toModel(payload));

export const remoteBatchUpdate = (payload: PrimitiveCharacter[]) =>
  put<boolean, Model[]>(`repertoire/batch`, payload.map(toModel));

export const remoteRemove = (unicode: number) =>
  del<boolean, undefined>(`repertoire/${unicode}`);
