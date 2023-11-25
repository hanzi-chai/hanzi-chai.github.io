import type { Glyph, GlyphOptionalUnicode } from "./data";

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
    return response as R | Err;
  };

export const listForm = async () =>
  await template("GET")<Glyph[], undefined>("form/all");

export const post = template("POST");

export const remoteCreateWithoutUnicode = (payload: GlyphOptionalUnicode) =>
  template("POST")<number, GlyphOptionalUnicode>(`form`, payload);

export const remoteCreate = (payload: Glyph) =>
  template("POST")<number, Glyph>(`form/${payload.unicode}`, payload);

export const remoteUpdate = (payload: Glyph) =>
  template("PUT")<boolean, Glyph>(`form/${payload.unicode}`, payload);

export const remoteRemove = (unicode: number) =>
  template("DELETE")<boolean, Glyph>(`form/${unicode}`);

export const remoteMutate = (payload: [number, number]) => {
  const [unicode, newUnicode] = payload;
  return template("PATCH")<boolean, number>(`form/${unicode}`, newUnicode);
};
