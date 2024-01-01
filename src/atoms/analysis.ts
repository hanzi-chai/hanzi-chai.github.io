import type { Analysis, Degenerator, Selector, SieveName } from "~/lib/config";
import { focusAtom } from "jotai-optics";
import { configFormAtom } from "./config";

export const analysisAtom = focusAtom(configFormAtom, (o) =>
  o.prop("analysis").valueOr({} as Analysis),
);

export const degeneratorAtom = focusAtom(analysisAtom, (o) =>
  o.prop("degenerator").valueOr({} as Degenerator),
);

export const degeneratorFeatureAtom = focusAtom(degeneratorAtom, (o) =>
  o.prop("feature").valueOr({} as NonNullable<Degenerator["feature"]>),
);

export const degeneratorNoCrossAtom = focusAtom(degeneratorAtom, (o) =>
  o.prop("no_cross").valueOr(false),
);

export const selectorAtom = focusAtom(analysisAtom, (o) =>
  o.prop("selector").valueOr([] as Selector),
);

export const strongAtom = focusAtom(analysisAtom, (o) =>
  o.prop("strong").valueOr([] as string[]),
);

export const weakAtom = focusAtom(analysisAtom, (o) =>
  o.prop("weak").valueOr([] as string[]),
);

export const customizeAtom = focusAtom(analysisAtom, (o) =>
  o.prop("customize").valueOr({} as NonNullable<Analysis["customize"]>),
);
