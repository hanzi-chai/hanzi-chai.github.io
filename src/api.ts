import type { PrimitiveCharacter } from "./lib/data";

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

interface PUA {
  type: "component" | "compound";
  name: string;
}

interface Mutation {
  old: number;
  new: number;
}

export const list = async () =>
  await get<PrimitiveCharacter[], undefined>("repertoire/all");

export const fetchCharacterByUnicode = async (unicode: number) =>
  get<PrimitiveCharacter, undefined>(`repertoire/${unicode}`);

export const remoteCreateWithoutUnicode = (payload: PUA) =>
  post<number, PUA>("repertoire", payload);

export const remoteCreate = (payload: PrimitiveCharacter) =>
  post<number, PrimitiveCharacter>(`repertoire/${payload.unicode}`, payload);

export const remoteUpdate = (payload: PrimitiveCharacter) =>
  put<boolean, PrimitiveCharacter>(`repertoire/${payload.unicode}`, payload);

export const remoteRemove = (unicode: number) =>
  del<boolean, PrimitiveCharacter>(`repertoire/${unicode}`);

export const remoteMutate = (payload: Mutation) =>
  put<boolean, Mutation>("repertoire", payload);
