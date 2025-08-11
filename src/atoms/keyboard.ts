import { focusAtom } from "jotai-optics";
import { keyboardAtom } from "./config";
import type {
  Grouping,
  Keyboard,
  Mapping,
  MappingGeneratorRule,
  MappingSpace,
} from "~/lib";
import { atom } from "jotai";

export const alphabetAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("alphabet").valueOr("abcdefghijklmnopqrstuvwxyz"),
);

export const mappingTypeAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping_type").valueOr(1),
);

export const mappingAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping").valueOr({} as Mapping),
);

export const groupingAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("grouping").valueOr({} as Grouping),
);

export const mappingCompatibleAtom = atom((get) => {
  const mapping = get(mappingAtom);
  const grouping = get(groupingAtom);
  const mappingCompatible: Mapping = {};
  for (const [key, value] of Object.entries(grouping)) {
    mappingCompatible[key] = { element: value };
  }
  return { ...mappingCompatible, ...mapping };
});

export const mappingSpaceAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping_space").valueOr({} as MappingSpace),
);

export const mappingGeneratorAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping_generator").valueOr([] as MappingGeneratorRule[]),
);
