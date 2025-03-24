import { focusAtom } from "jotai-optics";
import { keyboardAtom } from "./config";
import type { Grouping, Mapping } from "~/lib";

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
