import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Equivalence, Frequency } from "~/components/Optimizer";

export const userFrequencyAtom = atomWithStorage<Frequency | null>(
  "user_frequency",
  null,
);

export const userDictionaryAtom = atomWithStorage<[string, string][] | null>(
  "user_dictionary",
  null,
);

export const userKeyDistributionAtom = atomWithStorage<Equivalence | null>(
  "user_key_distribution",
  null,
);

export const userPairEquivalenceAtom = atomWithStorage<Equivalence | null>(
  "user_pair_equivalence",
  null,
);
