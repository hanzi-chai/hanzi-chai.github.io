import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Config, SieveName } from "~/lib/config";
import type { Character, Glyph } from "~/lib/data";
import type { Feature } from "~/lib/classifier";
import { focusAtom } from "jotai-optics";
import * as O from "optics-ts/standalone";

/** 需要在组件里手动修改它 */
export const configIdAtom = atom("");

export const configStorageAtomAtom = atom((get) => {
  const id = get(configIdAtom);
  console.log(id);
  return atomWithStorage(id, { data: { form: {} } } as Config);
});

export const configAtom = atom(
  (get) => get(get(configStorageAtomAtom)),
  (get, set, value: Config) => set(get(configStorageAtomAtom), value),
);

// 每个字段对应一种简写的办法
export const configInfoAtom = focusAtom(configAtom, (o) => o.prop("info"));
export const configDataAtom = focusAtom(configAtom, (o) => o.prop("data"));
export const configFormAtom = focusAtom(configAtom, (o) => o.prop("form"));
export const configEncoderAtom = focusAtom(configAtom, (o) =>
  o.prop("encoder"),
);

type Subtype = "form" | "repertoire" | "classifier";

////////////////// case "load"

export const loadConfigAtom = atom(null, (get, set, value: Config) => {
  set(configAtom, value);
});

////////////////// case "info"

export const setInfoAtom = atom(null, (get, set, value: Config["info"]) => {
  set(configInfoAtom, value);
});

////////////////// case "data"

export const addDataAtom = atom(
  null,
  (
    get,
    set,
    subtype: Subtype,
    key: string,
    value: number | Glyph | Character,
  ) => {
    const op = O.compose(subtype, key);
    // @ts-ignore
    set(configDataAtom, O.set(op, value, get(configDataAtom)));
  },
);

export const removeDataAtom = atom(
  null,
  (get, set, subtype: Subtype, key: string) => {
    const op = O.compose(O.atKey(subtype), O.atKey(key));
    set(configDataAtom, O.remove(op));
  },
);

////////////////// case "element"

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
  // @ts-ignore
  set(
    configAnalysisAtom,
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
    // @ts-ignore
    set(
      configAnalysisAtom,
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
    // @ts-ignore
    set(
      configAnalysisAtom,
      O.modify(op)((vari) => vari.concat(value)),
    );
  },
);

export const removeRootSelectorStrongWeakAtom = atom(
  null,
  (get, set, variant: Variant, value: string) => {
    const op = O.compose(variant, O.valueOr([]));
    // @ts-ignore
    set(
      configAnalysisAtom,
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

export const removeRootCustomizeAtom = atom(
  null,
  (get, set, key: string, value: string[]) => {
    const op = O.compose("customize", O.valueOr({}), O.atKey(key));
    set(configAnalysisAtom, O.remove(op));
  },
);

////////////////// case "encoder"

export const setEncoderAtom = atom(
  null,
  (get, set, value: Config["encoder"]) => {
    set(configEncoderAtom, value);
  },
);
