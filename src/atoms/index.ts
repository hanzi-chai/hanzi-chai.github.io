import { WritableAtom, useAtom, useAtomValue, useSetAtom } from "jotai";

export * from "jotai";
export * from "./constants";
export * from "./config";
export * from "./data";
export * from "./keyboard";
export * from "./encoder";
export * from "./analysis";
export * from "./optimization";
import * as O from "optics-ts/standalone";
import { SetStateAction } from "react";

export function useAddAtom<K extends string, V>(
  atom: WritableAtom<Record<K, V>, [SetStateAction<Record<K, V>>], void>,
) {
  const set = useSetAtom(atom);
  return (key: K, value: V) => {
    set(O.set(O.prop(key), value) as SetStateAction<Record<K, V>>);
  };
}

export function useRemoveAtom<K extends string, V>(
  atom: WritableAtom<Record<K, V>, [SetStateAction<Record<K, V>>], void>,
) {
  const set = useSetAtom(atom);
  return (key: K) => {
    set(O.remove(O.atKey(key)) as SetStateAction<Record<K, V>>);
  };
}

export function useAppendAtom<E>(
  atom: WritableAtom<E[], [SetStateAction<E[]>], void>,
) {
  const set = useSetAtom(atom);
  return (elem: E) => {
    set(O.set(O.appendTo, elem) as SetStateAction<E[]>);
  };
}

export function useExcludeAtom<E>(
  atom: WritableAtom<E[], [SetStateAction<E[]>], void>,
) {
  const set = useSetAtom(atom);
  return (index: number) => {
    set(O.remove(O.at(index)));
  };
}

export function useModifyAtom<E>(
  atom: WritableAtom<E[], [SetStateAction<E[]>], void>,
) {
  const set = useSetAtom(atom);
  return (index: number, value: E) => {
    set(O.set(O.at(index), value) as SetStateAction<E[]>);
  };
}

export function useListAtom<E>(
  atom: WritableAtom<E[], [SetStateAction<E[]>], void>,
) {
  return [
    useAtomValue(atom),
    useAppendAtom(atom),
    useExcludeAtom(atom),
    useModifyAtom(atom),
  ] as const;
}
