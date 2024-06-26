import { atomWithStorage } from "jotai/utils";
import type { Dictionary, Distribution, Equivalence, Frequency } from ".";
import { MiniDb } from "jotai-minidb";

const db = new MiniDb<Dictionary>();

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

export type CustomElementMap = Record<string, string[]>;

export const customElementsAtom = atomWithStorage<
  Record<string, CustomElementMap>
>("custom_elements", {});
