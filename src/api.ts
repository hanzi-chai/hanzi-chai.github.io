import type { 字符数据, 字形数据 } from "hanzi-chai";
import { createClient } from "@chai-api/client";
import { EquivalenceData } from "./equivalence";
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

export const listGlyphs = () => get<字形数据[]>("/glyphs");

export const createGlyph = (payload: 字形数据) =>
  post<number>("/glyphs", payload);

export const updateGlyph = (payload: 字形数据) =>
  put<boolean>(`/glyphs/${payload.id}`, payload);

export const removeGlyph = (id: number) => del<boolean>(`/glyphs/${id}`);

export const listEquivalence = () => get<EquivalenceData[]>("/equivalence");

export const createEquivalence = (payload: EquivalenceData) =>
  post<boolean>("/equivalence", payload);

export const login = (username: string, password: string) =>
  post<{ user: UserData; token: string }>("/login", { username, password });

export const signup = (payload: Signup) => post<boolean>("/users", payload);
