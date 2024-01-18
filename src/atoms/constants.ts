import { atom } from "jotai";
import type { PrimitiveRepertoire } from "~/lib";
import { produce } from "immer";
import { Equivalence, Frequency } from "~/components/Optimizer";
import {
  userCharacterFrequencyAtom,
  userKeyDistributionAtom,
  userPairEquivalenceAtom,
  userWordAtom,
  userWordFrequencyAtom,
} from "./assets";

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

export const primitiveRepertoireAtom = atom<PrimitiveRepertoire>({});
primitiveRepertoireAtom.debugLabel = "repertoire";

export const mutateRepertoireAtom = atom(
  null,
  (get, set, twoUnicode: [number, number]) => {
    const before = String.fromCodePoint(twoUnicode[0]);
    const after = String.fromCodePoint(twoUnicode[1]);
    const replaceIf = (s: string) => (s === before ? after : s);

    set(primitiveRepertoireAtom, (previous) =>
      produce(previous, (state) => {
        // update itself
        const value = state[before]!;
        delete state[before];
        state[after] = { ...value, unicode: after.codePointAt(0)! };
        // update references
        for (const [_, value] of Object.entries(state)) {
          value.glyphs.forEach((x) => {
            if (x.type === "derived_component") {
              x.source = x.source && replaceIf(x.source);
            } else if (x.type === "compound") {
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
export const keyDistributionAtom = atom<Frequency>({});
export const pairEquivalenceAtom = atom<Equivalence>({});

export const wordAtom = atom((get) => {
  const wordFrequency = get(wordFrequencyAtom);
  return Object.keys(wordFrequency);
});

export interface Assets {
  character_frequency: Frequency;
  word_frequency: Frequency;
  key_distribution: Frequency;
  pair_equivalence: Equivalence;
}

export const assetsAtom = atom((get) => {
  const character_frequency =
    get(userCharacterFrequencyAtom) ?? get(characterFrequencyAtom);
  const word_frequency = get(userWordFrequencyAtom) ?? get(wordFrequencyAtom);
  const key_distribution =
    get(userKeyDistributionAtom) ?? get(keyDistributionAtom);
  const pair_equivalence =
    get(userPairEquivalenceAtom) ?? get(pairEquivalenceAtom);
  const assets: Assets = {
    character_frequency,
    word_frequency,
    key_distribution,
    pair_equivalence,
  };
  return assets;
});

export const wordsAtom = atom((get) => {
  const userWord = get(userWordAtom);
  const { word_frequency } = get(assetsAtom);
  return userWord ?? Object.keys(word_frequency);
});
