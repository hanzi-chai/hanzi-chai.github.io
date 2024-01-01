import { focusAtom } from "jotai-optics";
import { encoderAtom } from ".";
import { ShortCodeScheme, WordRule } from "~/lib/config";

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

export const shortCodeSchemesAtom = focusAtom(encoderAtom, (o) =>
  o.prop("short_code_schemes").valueOr([] as ShortCodeScheme[]),
);

export const wordRulesAtom = focusAtom(encoderAtom, (o) =>
  o.prop("rules").valueOr([] as WordRule[]),
);
