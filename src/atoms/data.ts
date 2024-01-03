import type { Character, Form, Glyph, Repertoire } from "~/lib/data";
type Subtype = "form" | "repertoire" | "classifier";
import { dataAtom } from "./config";
import { focusAtom } from "jotai-optics";
import { Classifier, Feature } from "~/lib/classifier";
import { atom, useAtomValue } from "jotai";
import { formAtom, repertoireAtom } from "./constants";
import { isPUA } from "~/lib/utils";
import defaultClassifier from "~/lib/classifier";
import { getSequence } from "~/lib/component";
import { PartialClassifier } from "~/lib/config";

export const formCustomizationAtom = focusAtom(dataAtom, (o) =>
  o.prop("form").valueOr({} as Form),
);

export const repertoireCustomizationAtom = focusAtom(dataAtom, (o) =>
  o.prop("repertoire").valueOr({} as Repertoire),
);

export const classifierCustomizationAtom = focusAtom(dataAtom, (o) =>
  o.prop("classifier").valueOr({} as Record<Feature, number>),
);

export const displayAtom = atom((get) => {
  const form = get(formAtom);
  const customization = get(formCustomizationAtom);
  return (char: string) => {
    if (char.includes("-")) return char.split("-")[1]!;
    if (!isPUA(char)) return char;
    const name = (customization[char] || form[char])?.name;
    return name ?? "丢失的字根";
  };
});

export const customFormAtom = atom((get) => {
  const form = get(formAtom);
  const customization = get(formCustomizationAtom);
  return { ...form, ...customization };
});

export const sortedCustomFormAtom = atom((get) => {
  const form = get(customFormAtom);
  const sequence = get(sequenceAtom);
  return Object.entries(form).sort((a, b) => {
    return (
      (sequence.get(a[0]) ?? "").length - (sequence.get(b[0]) ?? "").length
    );
  });
});

export const sequenceAtom = atom((get) => {
  const form = get(customFormAtom);
  const result = new Map<string, string>();
  for (const char of Object.keys(form)) {
    result.set(char, getSequence(form, char, result));
  }
  return result;
});

export const tagsAtom = atom((get) => {
  const form = get(customFormAtom);
  const allTags = new Set<string>();
  for (const { compound } of Object.values(form)) {
    if (compound === undefined) continue;
    for (const { tags } of compound) {
      tags?.forEach((s) => allTags.add(s));
    }
  }
  return Array.from(allTags).sort();
});

export const customRepertoireAtom = atom((get) => {
  const repertoire = get(repertoireAtom);
  const customization = get(repertoireCustomizationAtom);
  return { ...repertoire, ...customization };
});

export const customClassifierAtom = atom((get) => {
  const customization = get(classifierCustomizationAtom);
  return { ...defaultClassifier, ...customization };
});

export const customDataAtom = atom((get) => {
  return {
    form: get(customFormAtom),
    repertoire: get(customRepertoireAtom),
    classifier: get(customClassifierAtom),
  };
});

export const nextUnicodeAtom = atom((get) => {
  const customization = get(formCustomizationAtom);
  const maxCode = Math.max(
    ...Object.keys(customization).map((x) => x.codePointAt(0)!),
  );
  return Math.max(maxCode + 1, 0xf000);
});
