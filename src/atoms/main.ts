import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Config, SieveName } from "~/lib/config";
import type { Character, Glyph } from "~/lib/data";
import type { Feature } from "~/lib/classifier";
import { focusAtom } from "jotai-optics";
import * as O from "optics-ts/standalone";

/** 需要在根组件里提前修改它 */
export const configIdAtom = atom("");

export const configStorageAtomAtom = atom((get) => {
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

// 每个字段对应一种简写的办法
export const configInfoAtom = focusAtom(configAtom, (o) => o.prop("info"));
export const configDataAtom = focusAtom(configAtom, (o) => o.prop("data"));
export const configFormAtom = focusAtom(configAtom, (o) => o.prop("form"));
export const configEncoderAtom = focusAtom(configAtom, (o) =>
  o.prop("encoder"),
);

////////////////// case "info"

export const setInfoAtom = atom(null, (get, set, value: Config["info"]) =>
  set(configInfoAtom, value),
);

////////////////// case "encoder"

export const setEncoderAtom = atom(
  null,
  (get, set, value: Config["encoder"]) => {
    set(configEncoderAtom, value);
  },
);
