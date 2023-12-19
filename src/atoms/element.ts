import { atom } from "jotai";
import type { SieveName } from "~/lib/config";
import type { Feature } from "~/lib/classifier";
import { focusAtom } from "jotai-optics";
import * as O from "optics-ts/standalone";

import { configFormAtom } from "./main";

export const setGenericAlphabetAtom = atom(null, (get, set, value: string) => {
  set(configFormAtom, O.set(O.prop("alphabet"))(value));
});

export const setGenericMaxCodeLenAtom = atom(
  null,
  (get, set, value: number) => {
    set(configFormAtom, O.set(O.prop("mapping_type"))(value));
  },
);

//////////////////  case "generic-mapping"
export const configMappingElementAtom = focusAtom(configFormAtom, (o) =>
  o.prop("mapping"),
);

export const addGenericMappingAtom = atom(
  null,
  (get, set, key: string, value: string) => {
    set(configMappingElementAtom, O.set(O.prop(key))(value));
  },
);

export const removeGenericMappingAtom = atom(null, (get, set, key: string) => {
  set(configMappingElementAtom, O.remove(O.atKey(key)));
});

////////////////// case "generic-mapping-batch":

export const batchGenericMappingAtom = atom(
  null,
  (get, set, value: Record<string, string>) => {
    set(configMappingElementAtom, (old) => ({ ...old, ...value }));
  },
);
////////////////// case "generic-grouping"

export const configGroupingElementAtom = focusAtom(configFormAtom, (o) =>
  o.prop("grouping"),
);

export const addGenericGroupingAtom = atom(
  null,
  (get, set, key: string, value: string) => {
    set(configGroupingElementAtom, O.set(O.prop(key))(value));
  },
);

export const removeGenericGroupingAtom = atom(null, (get, set, key: string) => {
  set(configGroupingElementAtom, O.remove(O.atKey(key)));
});

////////////////// case "root-degenerator"

export const configAnalysisAtom = focusAtom(configFormAtom, (o) =>
  o.prop("analysis"),
);
const opticsDegeneratorFeature = O.compose(
  O.valueOr({}),
  "degenerator",
  O.valueOr({}),
  "feature",
  O.valueOr({}),
);

export const addRootDegeneratorAtom = atom(
  null,
  (get, set, key: Feature, value: Feature) => {
    const op = O.compose(opticsDegeneratorFeature, key);
    // @ts-ignore
    set(configAnalysisAtom, O.set(op)(value));
  },
);

export const removeRootDegeneratorAtom = atom(
  null,
  (get, set, key: Feature) => {
    const op = O.compose(opticsDegeneratorFeature, O.atKey(key));
    set(configAnalysisAtom, O.remove(op));
  },
);

////////////////// case "root-degenerator-nocross"

const opticsDegenerator = O.compose(
  O.valueOr({}),
  "degenerator",
  O.valueOr({}),
);

export const switchRootDegeneratorNocross = atom(null, (get, set) => {
  const op = O.compose(opticsDegenerator, "no_cross", O.valueOr(false));
  set(
    configAnalysisAtom,
    // @ts-ignore
    O.modify(op)((v) => !v),
  );
});

////////////////// case "root-selector"
const opticsRootSelector = O.compose(O.valueOr({}), "selector", O.valueOr([]));

export const addRootSelectorAtom = atom(null, (get, set, value: SieveName) => {
  const op = O.compose(opticsRootSelector, O.appendTo);
  // @ts-ignore
  set(configAnalysisAtom, O.set(op)(value));
});

export const removeRootSelectorAtom = atom(
  null,
  (get, set, value: SieveName) => {
    set(
      configAnalysisAtom,
      // @ts-ignore
      O.modify(opticsRootSelector)((sele) => sele.filter((x) => x !== value)),
    );
  },
);

export const replaceRootSelectorAtom = atom(
  null,
  (get, set, value: SieveName[]) => {
    // @ts-ignore
    set(configAnalysisAtom, O.set(opticsRootSelector)(value));
  },
);

////////////////// case "root-selector-strongweak"

type Variant = "strong" | "weak";

export const addRootSelectorStrongWeakAtom = atom(
  null,
  (get, set, variant: Variant, value: string) => {
    const op = O.compose(variant, O.valueOr([]));
    set(
      configAnalysisAtom,
      // @ts-ignore
      O.modify(op)((vari) => vari.concat(value)),
    );
  },
);

export const removeRootSelectorStrongWeakAtom = atom(
  null,
  (get, set, variant: Variant, value: string) => {
    const op = O.compose(variant, O.valueOr([]));
    set(
      configAnalysisAtom,
      // @ts-ignore
      O.modify(op)((vari) => vari.filter((x) => x !== value)),
    );
  },
);

////////////////// case "root-customize"

export const addRootCustomizeAtom = atom(
  null,
  (get, set, key: string, value: string[]) => {
    const op = O.compose("customize", O.valueOr({}), key);
    // @ts-ignore
    set(configAnalysisAtom, O.set(op)(value));
  },
);

export const removeRootCustomizeAtom = atom(null, (get, set, key: string) => {
  const op = O.compose("customize", O.valueOr({}), O.atKey(key));
  set(configAnalysisAtom, O.remove(op));
});
