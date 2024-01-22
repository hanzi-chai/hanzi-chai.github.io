import { focusAtom } from "jotai-optics";
import { keyboardAtom } from "./config";
import { Grouping } from "~/lib";

export const alphabetAtom = focusAtom(keyboardAtom, (o) => o.prop("alphabet"));

export const mappingTypeAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping_type").valueOr(1),
);

export const mappingAtom = focusAtom(keyboardAtom, (o) => o.prop("mapping"));

export const groupingAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("grouping").valueOr({} as Grouping),
);
