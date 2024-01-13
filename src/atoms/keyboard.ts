import { focusAtom } from "jotai-optics";
import { keyboardsAtom } from "./config";

// create traversal optics for the following properties

export const alphabetAtom = focusAtom(keyboardsAtom, (o) => o.prop("alphabet"));
export const mappingTypeAtom = focusAtom(keyboardsAtom, (o) =>
  o.prop("mapping_type").valueOr(1),
);

export const mappingAtom = focusAtom(keyboardsAtom, (o) => o.prop("mapping"));

export const groupingAtom = focusAtom(keyboardsAtom, (o) => o.prop("grouping"));
