import { atom } from "jotai";
import type { PrimitiveRepertoire } from "~/lib";
import { produce } from "immer";
import {
  userFrequencyAtom,
  userKeyDistributionAtom,
  userPairEquivalenceAtom,
  userDictionaryAtom,
} from "./assets";

const _cache: Record<string, any> = {};
export async function fetchAsset(
  filename: string,
  type: "json" | "txt" = "json",
) {
  if (filename in _cache) {
    return _cache[filename];
  }
  const response = await fetch(`/cache/${filename}.${type}`);
  const content = await (type === "json" ? response.json() : response.text());
  _cache[filename] = content;
  return content;
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

interface Loss {
  ideal: number;
  lt_penalty: number;
  gt_penalty: number;
}

export type Dictionary = [string, string][];
export type Frequency = Record<string, number>;
export type Distribution = Record<string, Loss>;
export type Equivalence = Record<string, number>;

export const defaultDictionaryAtom = atom<Dictionary>([]);
export const frequencyAtom = atom<Frequency>({});
export const keyDistributionAtom = atom<Distribution>({});
export const pairEquivalenceAtom = atom<Equivalence>({});

export interface Assets {
  frequency: Frequency;
  key_distribution: Distribution;
  pair_equivalence: Equivalence;
}

export const assetsAtom = atom((get) => {
  const frequency = get(userFrequencyAtom) ?? get(frequencyAtom);
  const key_distribution =
    get(userKeyDistributionAtom) ?? get(keyDistributionAtom);
  const pair_equivalence =
    get(userPairEquivalenceAtom) ?? get(pairEquivalenceAtom);
  const assets: Assets = {
    frequency,
    key_distribution,
    pair_equivalence,
  };
  return assets;
});

export const dictionaryAtom = atom((get) => {
  return get(userDictionaryAtom) ?? get(defaultDictionaryAtom);
});
