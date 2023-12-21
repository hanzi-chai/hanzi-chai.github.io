import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Config } from "~/lib/config";
import { focusAtom } from "jotai-optics";
import * as O from "optics-ts/standalone";

/** 需要在根组件里提前修改它 */
export const configIdAtom = atom("");
configIdAtom.debugLabel = "id";

const configStorageAtomAtom = atom((get) => {
  const id = get(configIdAtom);
  return atomWithStorage(id, { data: { form: {} } } as Config);
});

/**
 * Config 对象一共有 7 个字段，除了 version 和 source 不可变外，均可以通过 action 改变
 * - LoadAction 可以直接替换 Config 本身
 * - InfoAction 对应 info 字段
 * - DataAction 对应 data 字段
 * - ElementAction 对应 form 和 pronunciation 字段
 * - EncoderAction 对应 encoder 字段
 */

export const configAtom = atom(
  (get) => get(get(configStorageAtomAtom)),
  (get, set, value: Config) => set(get(configStorageAtomAtom), value),
);

configAtom.debugLabel = "main config atom";

// 每个字段对应一种简写的办法
export const configInfoAtom = focusAtom(configAtom, (o) => o.prop("info"));
configInfoAtom.debugLabel = "config.info";
export const configDataAtom = focusAtom(configAtom, (o) => o.prop("data"));
configDataAtom.debugLabel = "config.data";
export const configFormAtom = focusAtom(configAtom, (o) => o.prop("form"));
configFormAtom.debugLabel = "config.form";
export const encoderAtom = focusAtom(configAtom, (o) => o.prop("encoder"));
encoderAtom.debugLabel = "config.encoder";

export const defaultOptimization: NonNullable<Config["optimization"]> = {
  objective: {},
  metaheuristic: {
    algorithm: "SimulatedAnnealing",
  },
};

export const optimAtom = focusAtom(configAtom, (o) =>
  o.prop("optimization").valueOr(defaultOptimization),
);
optimAtom.debugLabel = "config.optimization";

////////////////// case "info"

export const setInfoAtom = atom(null, (get, set, value: Config["info"]) =>
  set(configInfoAtom, value),
);
