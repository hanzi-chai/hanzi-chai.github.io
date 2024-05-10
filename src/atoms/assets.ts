import { atomWithStorage } from "jotai/utils";
import { Equivalence, Frequency } from "~/components/Optimizer";
import { Dictionary } from ".";
import { MiniDb } from "jotai-minidb";

const db = new MiniDb<Dictionary>();

export const userFrequencyAtom = atomWithStorage<Frequency | undefined>(
  "user_frequency",
  undefined,
);

export const userDictionaryAtom = db.item("user_dictionary");

export const userKeyDistributionAtom = atomWithStorage<Equivalence | undefined>(
  "user_key_distribution",
  undefined,
);

export const userPairEquivalenceAtom = atomWithStorage<Equivalence | undefined>(
  "user_pair_equivalence",
  undefined,
);
