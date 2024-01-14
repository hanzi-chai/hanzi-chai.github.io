import { focusAtom } from "jotai-optics";
import { keyboardAtom } from "./config";

// create traversal optics for the following properties

export const alphabetAtom = focusAtom(keyboardAtom, (o) => o.prop("alphabet"));
export const mappingTypeAtom = focusAtom(keyboardAtom, (o) =>
  o.prop("mapping_type").valueOr(1),
);

export const mappingAtom = focusAtom(keyboardAtom, (o) => o.prop("mapping"));

export const groupingAtom = focusAtom(keyboardAtom, (o) => o.prop("grouping"));
