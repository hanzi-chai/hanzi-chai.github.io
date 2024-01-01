import { focusAtom } from "jotai-optics";
import { configFormAtom } from "./config";

export const alphabetAtom = focusAtom(configFormAtom, (o) =>
  o.prop("alphabet"),
);
export const mappingTypeAtom = focusAtom(configFormAtom, (o) =>
  o.prop("mapping_type").valueOr(1),
);

export const mappingAtom = focusAtom(configFormAtom, (o) => o.prop("mapping"));

export const groupingAtom = focusAtom(configFormAtom, (o) =>
  o.prop("grouping"),
);
