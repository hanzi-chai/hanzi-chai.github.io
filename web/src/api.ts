import { createClient } from "@chai-api/client";
import type { EquivalenceData, 基本字形数据, 字符数据 } from "hanzi-chai";
import { 格式化字形ID } from "hanzi-chai";

export { endpoint, type 后端错误 } from "@chai-api/client";

export interface Signin {
  id: string;
  password: string;
}

export interface Signup extends Signin {
  name: string;
  email: string;
}

export interface UserData extends Signup {
  avatar: string;
  role: 0 | 1 | 2;
  status: 0 | 1;
}

const { get, post, put, del } = createClient(() => {
  if (globalThis.localStorage) {
    return localStorage.getItem("token");
  }
  return null;
});

export const listCharacters = () => get<字符数据[]>("/characters");

export const remoteCreateWithoutUnicode = (payload: 字符数据) =>
  post<number>("/characters", payload);

export const createCharacter = (payload: 字符数据) =>
  post<number>(`/characters/${payload.unicode}`, payload);

export const updateCharacter = (payload: 字符数据) =>
  put<boolean>(`/characters/${payload.unicode}`, payload);

export const batchUpdateCharacter = (payload: 字符数据[]) =>
  put<boolean>("/characters/batch", payload);

export const removeCharacter = (unicode: number) =>
  del<boolean>(`/characters/${unicode}`);

export const listGlyphs = () => get<基本字形数据[]>("/glyphs");

export const createGlyph = (payload: 基本字形数据) =>
  post<number>("/glyphs", payload);

export const updateGlyph = (payload: 基本字形数据) =>
  put<boolean>(`/glyphs/${格式化字形ID(payload.id)}`, payload);

export const replaceGlyph = (payload: { oldId: number; newId: number }) =>
  put<boolean>("/glyphs", payload);

export const removeGlyph = (id: number) =>
  del<boolean>(`/glyphs/${格式化字形ID(id)}`);

export const listEquivalence = () => get<EquivalenceData[]>("/equivalence");

export const createEquivalence = (payload: EquivalenceData) =>
  post<boolean>("/equivalence", payload);

export const login = (username: string, password: string) =>
  post<{ user: UserData; token: string }>("/login", { username, password });

export const signup = (payload: Signup) => post<boolean>("/users", payload);
