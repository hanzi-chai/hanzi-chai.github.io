import { atom } from "jotai";
import type { Form, Repertoire } from "~/lib/data";
import { listToObject } from "~/lib/utils";

const _cache: Record<string, any> = {};
async function fetchJson(filename: string) {
  if (filename in _cache) {
    return _cache[filename];
  }
  const request = await fetch(`/cache/${filename}.json`);
  const json = await request.json();
  _cache[filename] = listToObject(json);
  return json;
}

export const formAtom = atom<Form>({});
export const loadFormAtom = atom(null, async (get, set) => {
  const data = (await fetchJson("form")) as Form;
  set(formAtom, data);
});

export const repertoireAtom = atom<Repertoire>({});
export const loadRepertoireAtom = atom(null, async (get, set) => {
  const data = (await fetchJson("repertoire")) as Repertoire;
  set(repertoireAtom, data);
});
