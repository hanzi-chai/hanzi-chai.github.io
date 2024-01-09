import { atom } from "jotai";
import type { Repertoire } from "~/lib/data";
import { produce } from "immer";
import { Equivalence, Frequency } from "~/components/Evaluator";

const _cache: Record<string, any> = {};
export async function fetchJson(filename: string) {
  if (filename in _cache) {
    return _cache[filename];
  }
  const request = await fetch(`/cache/${filename}.json`);
  const json = await request.json();
  _cache[filename] = json;
  return json;
}

export const repertoireAtom = atom<Repertoire>({});
repertoireAtom.debugLabel = "repertoire";

export const mutateFormAtom = atom(
  null,
  (get, set, twoUnicode: [number, number]) => {
    const before = String.fromCodePoint(twoUnicode[0]);
    const after = String.fromCodePoint(twoUnicode[1]);
    const replaceIf = (s: string) => (s === before ? after : s);

    set(repertoireAtom, (oldForm) =>
      produce(oldForm, (state) => {
        // update itself
        const value = state[before]!;
        delete state[before];
        state[after] = { ...value, unicode: after.codePointAt(0)! };
        // update references
        for (const [_, value] of Object.entries(state)) {
          value.glyphs.forEach((x) => {
            if (x.type === "component") {
              x.source = x.source && replaceIf(x.source);
            } else {
              x.operandList = x.operandList.map(replaceIf);
            }
          });
        }
      }),
    );
  },
);

export const characterFrequencyAtom = atom<Frequency>({});
export const wordFrequencyAtom = atom<Frequency>({});
export const keyEquivalenceAtom = atom<Equivalence>({});
export const pairEquivalenceAtom = atom<Equivalence>({});
