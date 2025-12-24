import { focusAtom } from "jotai-optics";
import { keyboardAtom } from "./config";
import type {
  Mapping,
  MappingGeneratorRule,
  MappingSpace,
  MappingVariableRule,
} from "~/lib";

export const alphabetAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("alphabet").valueOr("abcdefghijklmnopqrstuvwxyz"),
);

export const mappingTypeAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping_type").valueOr(1),
);

export const mappingAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping").valueOr({} as Mapping),
);

export const mappingSpaceAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping_space").valueOr({} as MappingSpace),
);

export const mappingVariablesAtom = focusAtom(keyboardAtom, (o) =>
  o
    .prop("mapping_variables")
    .valueOr({} as Record<string, MappingVariableRule>),
);

export const mappingGeneratorsAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping_generators").valueOr([] as MappingGeneratorRule[]),
);
