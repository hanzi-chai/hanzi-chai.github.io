import { atom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import type {
  Analysis,
  Data,
  EncoderConfig,
  DiagramConfig,
  Keyboard,
} from "~/lib";
import {
  defaultOptimization,
  type Algebra,
  type Config,
  type Info,
} from "~/lib";
import { examples, defaultConfig, Example } from "~/templates";
import { focusAtom } from "jotai-optics";
import { atomWithLocation } from "jotai-location";

const locationAtom = atomWithLocation();

export const idAtom = atom((get) => {
  if (import.meta.env.MODE === "CF") {
    return get(locationAtom).pathname?.split("/")[1] ?? "";
  }
  return get(locationAtom).hash?.split("/")[1] ?? "";
});

const configStorage = atomFamily((id: string) =>
  atomWithStorage<Config>(id, examples[id as Example] ?? defaultConfig),
);

export const configAtom = atom(
  (get) => get(configStorage(get(idAtom))),
  (get, set, value: Config) => set(configStorage(get(idAtom)), value),
);
configAtom.debugLabel = "config";

export const infoAtom = focusAtom(configAtom, (o) =>
  o.prop("info").valueOr({} as Info),
);
infoAtom.debugLabel = "config.info";
export const dataAtom = focusAtom(configAtom, (o) =>
  o.prop("data").valueOr({} as Data),
);
dataAtom.debugLabel = "config.data";
export const analysisAtom = focusAtom(configAtom, (o) =>
  o.prop("analysis").valueOr({} as Analysis),
);
analysisAtom.debugLabel = "config.analysis";
export const algebraAtom = focusAtom(configAtom, (o) =>
  o.prop("algebra").valueOr({} as Algebra),
);
algebraAtom.debugLabel = "config.algebra";
export const keyboardAtom = focusAtom(configAtom, (o) =>
  o.prop("form").valueOr({} as Keyboard),
);
keyboardAtom.debugLabel = "config.keyboards";
export const encoderAtom = focusAtom(configAtom, (o) =>
  o.prop("encoder").valueOr({} as EncoderConfig),
);
encoderAtom.debugLabel = "config.encoder";
export const optimAtom = focusAtom(configAtom, (o) =>
  o.prop("optimization").valueOr(defaultOptimization),
);
optimAtom.debugLabel = "config.optimization";
export const diagramAtom = focusAtom(configAtom, (o) =>
  o.prop("diagram").valueOr({ layout: [], contents: [] } as DiagramConfig),
);
diagramAtom.debugLabel = "config.diagram";
