import { atomWithStorage } from "jotai/utils";
import type {
  CustomElementMap,
  Dictionary,
  Distribution,
  Equivalence,
  Frequency,
} from "~/lib";
import { MiniDb } from "jotai-minidb";
import { atom } from "jotai";
import {
  adapt,
  getDictFromTSV,
  getDistributionFromTSV,
  getRecordFromTSV,
  stringifySequence,
  type PrimitiveRepertoire,
} from "~/lib";
import { produce } from "immer";
import { charactersAtom } from "./data";
import { configAtom } from "./config";
import { assemblyResultAtom } from "./cache";

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
            } else if (
              x.type === "compound" ||
              x.type === "spliced_component"
            ) {
              x.operandList = x.operandList.map(replaceIf);
            }
          });
        }
      }),
    );
  },
);

export const defaultDictionaryAtom = atom<Promise<Dictionary>>(async () =>
  getDictFromTSV(await fetchAsset("dictionary", "txt")),
);
export const frequencyAtom = atom<Promise<Frequency>>(async () =>
  getRecordFromTSV(await fetchAsset("frequency", "txt")),
);
export const keyDistributionAtom = atom<Promise<Distribution>>(async () =>
  getDistributionFromTSV(await fetchAsset("key_distribution", "txt")),
);
export const pairEquivalenceAtom = atom<Promise<Equivalence>>(async () =>
  getRecordFromTSV(await fetchAsset("pair_equivalence", "txt")),
);

export const inputAtom = atom(async (get) => {
  const key_distribution =
    get(userKeyDistributionAtom) ?? (await get(keyDistributionAtom));
  const pair_equivalence =
    get(userPairEquivalenceAtom) ?? (await get(pairEquivalenceAtom));
  const config = get(configAtom);
  const assemblyResult = stringifySequence(await get(assemblyResultAtom));
  return {
    配置: config,
    词列表: assemblyResult,
    原始键位分布信息: key_distribution,
    原始当量信息: pair_equivalence,
  };
});

export const adaptedFrequencyAtom = atom(async (get) => {
  const frequency = get(userFrequencyAtom) ?? (await get(frequencyAtom));
  const characters = get(charactersAtom);
  const dictionary = await get(dictionaryAtom);
  const words = new Set(characters);
  dictionary.forEach(([word]) => words.add(word));
  return adapt(frequency, words);
});

export const dictionaryAtom = atom(async (get) => {
  return get(userDictionaryAtom) ?? (await get(defaultDictionaryAtom));
});

const db = new MiniDb<Dictionary>();

export const userCharacterSetAtom = atomWithStorage<string[] | undefined>(
  "user_character_set",
  undefined,
);

export const userFrequencyAtom = atomWithStorage<Frequency | undefined>(
  "user_frequency",
  undefined,
);

export const userDictionaryAtom = db.item("user_dictionary");

export const userKeyDistributionAtom = atomWithStorage<
  Distribution | undefined
>("user_key_distribution", undefined);

export const userPairEquivalenceAtom = atomWithStorage<Equivalence | undefined>(
  "user_pair_equivalence",
  undefined,
);

export const customElementsAtom = atomWithStorage<
  Record<string, CustomElementMap>
>("custom_elements", {});

export const processedCustomElementsAtom = atom((get) => {
  const customElements = get(customElementsAtom);
  const content = new Map<string, string[]>(
    Object.entries(customElements).map(([name, map]) => {
      const set = new Set(Object.values(map).flat());
      return [name, [...set].sort().map((x) => `${name}-${x}`)];
    }),
  );
  return content;
});
