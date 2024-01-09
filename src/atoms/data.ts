import { atom, useAtomValue } from "jotai";
import { repertoireAtom } from "./constants";
import { isPUA } from "~/lib/utils";
import { getSequence } from "~/lib/component";
import { dataAtom } from ".";
import { focusAtom } from "jotai-optics";
import {
  Component,
  Compound,
  DeterminedCharacter,
  Repertoire,
} from "~/lib/data";
import { Customization } from "~/lib/config";
import { determine } from "~/lib/repertoire";

export const userRepertoireAtom = focusAtom(dataAtom, (o) =>
  o.prop("repertoire").valueOr({} as Repertoire),
);
userRepertoireAtom.debugLabel = "config.data.repertoire";
export const customizationAtom = focusAtom(dataAtom, (o) =>
  o.prop("customization").valueOr({} as Customization),
);
customizationAtom.debugLabel = "config.data.customization";
export const userTagsAtom = focusAtom(dataAtom, (o) =>
  o.prop("tags").valueOr([] as string[]),
);

export const allRepertoireAtom = atom((get) => {
  const repertoire = get(repertoireAtom);
  const userRepertoire = get(userRepertoireAtom);
  return { ...repertoire, ...userRepertoire };
});

export const displayAtom = atom((get) => {
  const repertoire = get(allRepertoireAtom);
  return (char: string) => {
    if (char.includes("-")) return char.split("-")[1]!;
    if (!isPUA(char)) return char;
    const name = repertoire[char]?.name;
    return name ?? "丢失的字根";
  };
});

export const determinedRepertoireAtom = atom((get) => {
  const repertoire = get(allRepertoireAtom);
  const customization = get(customizationAtom);
  const tags = get(userTagsAtom);
  return determine(repertoire);
});

export const sortedCustomFormAtom = atom((get) => {
  const form = get(determinedRepertoireAtom);
  const sequence = get(sequenceAtom);
  return Object.entries(form).sort((a, b) => {
    return (
      (sequence.get(a[0]) ?? "").length - (sequence.get(b[0]) ?? "").length
    );
  });
});

export const sequenceAtom = atom((get) => {
  const form = get(determinedRepertoireAtom);
  const result = new Map<string, string>();
  for (const [char, value] of Object.entries(form)) {
    if (value.glyph !== undefined) {
      result.set(char, getSequence(form, char, result));
    }
  }
  return result;
});

export const tagsAtom = atom((get) => {
  const form = get(allRepertoireAtom);
  const allTags = new Set<string>();
  for (const { glyphs } of Object.values(form)) {
    for (const { tags } of glyphs) {
      tags?.forEach((s) => allTags.add(s));
    }
  }
  return Array.from(allTags).sort();
});

export const nextUnicodeAtom = atom((get) => {
  const customization = get(userRepertoireAtom);
  const maxCode = Math.max(
    ...Object.keys(customization).map((x) => x.codePointAt(0)!),
  );
  return Math.max(maxCode + 1, 0xf000);
});
