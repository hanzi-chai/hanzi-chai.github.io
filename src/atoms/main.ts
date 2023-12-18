import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Config, SieveName } from "~/lib/config";
import { focusAtom } from "jotai-optics";

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
// export const configInfoAtom = focusAtom(configAtom, o => o.prop('info'))
// export const configDataAtom = focusAtom(configAtom, o => o.prop('data'))
// export const configFormAtom = focusAtom(configAtom, o => o.prop('form'))
// export const configEncoderAtom = focusAtom(configAtom, o => o.prop('encoder'))

// export const loadConfigAtom = atom(null,(get,set,value:Config) => { set(configAtom,value) })
// export const setInfoAtom = atom(null,(get,set,value:Config['info']) => { set(configAtom,value) })
