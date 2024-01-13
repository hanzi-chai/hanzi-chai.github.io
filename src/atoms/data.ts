import { atom, useAtomValue } from "jotai";
import { repertoireAtom } from "./constants";
import { isPUA } from "~/lib/utils";
import { getSequence } from "~/lib/component";
import { dataAtom } from ".";
import { focusAtom } from "jotai-optics";
import { PrimitiveRepertoire } from "~/lib/data";
import { CustomGlyph } from "~/lib/config";
import { determine } from "~/lib/repertoire";

export const userRepertoireAtom = focusAtom(dataAtom, (o) =>
  o.prop("repertoire").valueOr({} as PrimitiveRepertoire),
);
userRepertoireAtom.debugLabel = "config.data.repertoire";
export const customGlyphAtom = focusAtom(dataAtom, (o) =>
  o.prop("glyph_customization").valueOr({} as CustomGlyph),
);
customGlyphAtom.debugLabel = "config.data.customGlyph";
export const customReadingsAtom = focusAtom(dataAtom, (o) =>
  o.prop("reading_customization").valueOr({} as CustomGlyph),
);
customReadingsAtom.debugLabel = "config.data.customReadings";
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
  const customization = get(customGlyphAtom);
  const tags = get(userTagsAtom);
  return determine(repertoire);
});

export const sortedRepertoireAtom = atom((get) => {
  const determinedRepertoire = get(determinedRepertoireAtom);
  const sequence = get(sequenceAtom);
  return Object.entries(determinedRepertoire).sort((a, b) => {
    return (
      (sequence.get(a[0]) ?? "").length - (sequence.get(b[0]) ?? "").length
    );
  });
});

export const sequenceAtom = atom((get) => {
  const determinedRepertoire = get(determinedRepertoireAtom);
  const result = new Map<string, string>();
  for (const [char, value] of Object.entries(determinedRepertoire)) {
    if (value.glyph !== undefined) {
      result.set(char, getSequence(determinedRepertoire, char, result));
    }
  }
  return result;
});

export const tagsAtom = atom((get) => {
  const allRepertoire = get(allRepertoireAtom);
  const allTags = new Set<string>();
  for (const { glyphs } of Object.values(allRepertoire)) {
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
