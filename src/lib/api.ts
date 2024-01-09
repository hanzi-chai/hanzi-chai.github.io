import type { Character } from "./data";

export const endpoint = "https://api.chaifen.app/";

export interface Err {
  err: string;
  message: string;
}

const getHeader = () => {
  const token = localStorage.getItem(".token");
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
    return response as R;
  };

export const list = async () =>
  await template("GET")<Character[], undefined>("repertoire/all");

export const post = template("POST");

interface PUA {
  type: "component" | "compound";
  name: string;
}

interface Mutation {
  old: number;
  new: number;
}

export const remoteCreateWithoutUnicode = (payload: PUA) =>
  template("POST")<number, PUA>(`repertoire`, payload);

export const remoteCreate = (payload: Character) =>
  template("POST")<number, Character>(`repertoire/${payload.unicode}`, payload);

export const remoteUpdate = (payload: Character) =>
  template("PUT")<boolean, Character>(`repertoire/${payload.unicode}`, payload);

export const remoteRemove = (unicode: number) =>
  template("DELETE")<boolean, Character>(`repertoire/${unicode}`);

export const remoteMutate = (payload: Mutation) =>
  template("PUT")<boolean, Mutation>(`repertoire`, payload);
