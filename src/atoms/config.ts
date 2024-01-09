import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  defaultOptimization,
  type Algebra,
  type Config,
  type Info,
  Customization,
} from "~/lib/config";
import { focusAtom } from "jotai-optics";

/** 需要在根组件里提前修改它 */
export const configIdAtom = atom("");
configIdAtom.debugLabel = "id";

const configStorageAtomAtom = atom((get) => {
  const id = get(configIdAtom);
  return atomWithStorage(id, {} as Config);
});

export const configAtom = atom(
  (get) => get(get(configStorageAtomAtom)),
  (get, set, value: Config) => set(get(configStorageAtomAtom), value),
);
configAtom.debugLabel = "config";

export const infoAtom = focusAtom(configAtom, (o) =>
  o.prop("info").valueOr({} as Info),
);
infoAtom.debugLabel = "config.info";
export const dataAtom = focusAtom(configAtom, (o) =>
  o.prop("data").valueOr({} as NonNullable<Config["data"]>),
);
dataAtom.debugLabel = "config.data";
export const algebraAtom = focusAtom(configAtom, (o) =>
  o.prop("algebra").valueOr({} as Algebra),
);
algebraAtom.debugLabel = "config.algebra";
export const configFormAtom = focusAtom(configAtom, (o) => o.prop("form"));
configFormAtom.debugLabel = "config.form";
export const encoderAtom = focusAtom(configAtom, (o) => o.prop("encoder"));
encoderAtom.debugLabel = "config.encoder";
export const optimAtom = focusAtom(configAtom, (o) =>
  o.prop("optimization").valueOr(defaultOptimization),
);
optimAtom.debugLabel = "config.optimization";
