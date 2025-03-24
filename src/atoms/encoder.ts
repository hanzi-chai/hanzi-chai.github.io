import { focusAtom } from "jotai-optics";
import { atom, encoderAtom } from ".";
import type {
  LevelWeights,
  Objective,
  PartialWeights,
  PartialWeightTypes,
  ShortCodeRule,
  WordRule,
} from "~/lib";
import { range } from "lodash-es";

export const maxLengthAtom = focusAtom(encoderAtom, (o) =>
  o.prop("max_length"),
);

export const autoSelectLengthAtom = focusAtom(encoderAtom, (o) =>
  o.prop("auto_select_length"),
);

export const autoSelectPatternAtom = focusAtom(encoderAtom, (o) =>
  o.prop("auto_select_pattern"),
);

export const selectKeysAtom = focusAtom(encoderAtom, (o) =>
  o.prop("select_keys").valueOr([] as string[]),
);

export const shortCodeConfigAtom = focusAtom(encoderAtom, (o) =>
  o.prop("short_code").valueOr([] as ShortCodeRule[]),
);

export const wordRulesAtom = focusAtom(encoderAtom, (o) =>
  o.prop("rules").valueOr([] as WordRule[]),
);

export const priorityShortCodesAtom = focusAtom(encoderAtom, (o) =>
  o.prop("priority_short_codes").valueOr([] as [string, string, number][]),
);

export const sourcesAtom = focusAtom(encoderAtom, (o) => o.prop("sources"));

export const conditionsAtom = focusAtom(encoderAtom, (o) =>
  o.prop("conditions"),
);

const isMulti = (s: ShortCodeRule) => {
  if ("length_equal" in s) {
    return s.length_equal > 1;
  } else {
    return s.length_in_range[1] > 1;
  }
};

const makeTier = (top: number, levelWeights: LevelWeights[]) => ({
  top: top === 0 ? undefined : top,
  duplication: 1,
  levels: levelWeights,
  fingering: [1, 1, 1, 1, 1, 1, null, null],
});

export const meaningfulObjectiveAtom = atom((get) => {
  const wordRules = get(wordRulesAtom);
  const shortCodeConfig = get(shortCodeConfigAtom);
  const maxLength = get(maxLengthAtom);
  const levelWeights: LevelWeights[] = range(1, maxLength + 1).map((i) => ({
    length: i,
    frequency: 1,
  }));
  const partialObjective: PartialWeights = {
    duplication: 1,
    key_distribution: 1,
    pair_equivalence: 1,
    fingering: [1, 1, 1, 1, 1, 1, null, null],
    levels: levelWeights,
  };
  const p1 = {
    ...partialObjective,
    tiers: [300, 500, 1500, 3000, 4500, 6000, 0].map((x) =>
      makeTier(x, levelWeights),
    ),
  };
  const p2 = {
    ...partialObjective,
    tiers: [2000, 5000, 10000, 20000, 40000, 60000, 0].map((x) =>
      makeTier(x, levelWeights),
    ),
  };
  const objective: Objective = {
    characters_full: p1,
  };
  if (wordRules.length > 0) {
    objective.words_full = p2;
  }
  if (shortCodeConfig.length > 0) {
    objective.characters_short = p1;
    if (wordRules.length > 0 && shortCodeConfig.some(isMulti)) {
      objective.words_short = p2;
    }
  }
  return objective;
});

export const meaningfulTypesAtom = atom((get) => {
  const objective = get(meaningfulObjectiveAtom);
  return Object.keys(objective) as PartialWeightTypes[];
});

export const typeLabels: Record<PartialWeightTypes, string> = {
  characters_full: "一字全码",
  characters_short: "一字简码",
  words_full: "多字全码",
  words_short: "多字简码",
};
