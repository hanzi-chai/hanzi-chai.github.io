import { atom } from "jotai";
import type { Form, Glyph, Repertoire } from "~/lib/data";
import { listToObject } from "~/lib/utils";
import { produce } from "immer";
import * as O from "optics-ts/standalone";
import { Equivalence, Frequency } from "~/components/Evaluator";

const _cache: Record<string, any> = {};
async function fetchJson(filename: string) {
  if (filename in _cache) {
    return _cache[filename];
  }
  const request = await fetch(`/cache/${filename}.json`);
  const json = await request.json();
  _cache[filename] = json;
  return json;
}

export const formAtom = atom<Form>({});
formAtom.debugLabel = "form atom";

export const loadFormAtom = atom(null, async (get, set) => {
  const data = await fetchJson("form");
  set(formAtom, listToObject(data) as Form);
});

export const updateFormAtom = atom(null, (get, set, value: Glyph) => {
  set(formAtom, O.set(O.prop(String.fromCodePoint(value.unicode)))(value));
});

export const removeFormAtom = atom(null, (get, set, codePoint: number) => {
  set(formAtom, O.remove(O.atKey(String.fromCodePoint(codePoint))));
});

export const mutateFormAtom = atom(
  null,
  (get, set, twoUnicode: [number, number]) => {
    const before = String.fromCodePoint(twoUnicode[0]);
    const after = String.fromCodePoint(twoUnicode[1]);
    const replaceIf = (s: string) => (s === before ? after : s);

    set(formAtom, (oldForm) =>
      produce(oldForm, (state) => {
        // update itself
        const value = state[before]!;
        delete state[before];
        state[after] = { ...value, unicode: after.codePointAt(0)! };
        // update references
        for (const [_, value] of Object.entries(state)) {
          if (value.component?.source !== undefined) {
            value.component.source = replaceIf(value.component.source);
          }
          if (value.compound !== undefined) {
            value.compound.forEach((x) => {
              x.operandList = x.operandList.map(replaceIf);
            });
          }
        }
      }),
    );
  },
);

export const repertoireAtom = atom<Repertoire>({});
repertoireAtom.debugLabel = "repertoire atom";
export const loadRepertoireAtom = atom(null, async (get, set) => {
  const data = await fetchJson("repertoire");
  set(repertoireAtom, listToObject(data) as Repertoire);
});

export const characterFrequencyAtom = atom<Frequency>({});
export const loadCFAtom = atom(null, async (_, set) => {
  const data = (await fetchJson("character_frequency")) as Frequency;
  set(characterFrequencyAtom, data);
});
export const wordFrequencyAtom = atom<Frequency>({});
export const loadWFAtom = atom(null, async (_, set) => {
  const data = (await fetchJson("word_frequency")) as Frequency;
  set(wordFrequencyAtom, data);
});
export const keyEquivalenceAtom = atom<Equivalence>({});
export const loadKEAtom = atom(null, async (_, set) => {
  const data = (await fetchJson("key_equivalence")) as Equivalence;
  set(keyEquivalenceAtom, data);
});
export const pairEquivalenceAtom = atom<Equivalence>({});
export const loadPEAtom = atom(null, async (_, set) => {
  const data = (await fetchJson("pair_equivalence")) as Equivalence;
  set(pairEquivalenceAtom, data);
});
