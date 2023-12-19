import { atom } from "jotai";
import type { Character, Glyph } from "~/lib/data";
type Subtype = "form" | "repertoire" | "classifier";
import * as O from "optics-ts/standalone";
import { configDataAtom } from "./main";

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
