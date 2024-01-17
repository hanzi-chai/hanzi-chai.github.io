import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Equivalence, Frequency } from "~/components/Optimizer";

export const userCharacterFrequencyAtom = atomWithStorage<Frequency | null>(
  "user_character_frequency",
  null,
);

export const userWordFrequencyAtom = atomWithStorage<Frequency | null>(
  "user_word_frequency",
  null,
);

export const userWordAtom = atomWithStorage<string[] | null>(
  "user_word_list",
  null,
);

export const userKeyDistributionAtom = atomWithStorage<Frequency | null>(
  "user_key_distribution",
  null,
);

export const userPairEquivalenceAtom = atomWithStorage<Equivalence | null>(
  "user_pair_equivalence",
  null,
);
