import type { Character, Form, Glyph, Repertoire } from "~/lib/data";
type Subtype = "form" | "repertoire" | "classifier";
import { dataAtom } from "./main";
import { focusAtom } from "jotai-optics";
import { Classifier } from "~/lib/classifier";
import { useAtomValue } from "jotai";
import { formAtom, repertoireAtom } from "./constants";
import { isPUA } from "~/lib/utils";
import defaultClassifier from "~/lib/classifier";

export const formCustomizationAtom = focusAtom(dataAtom, (o) =>
  o.prop("form").valueOr({} as Form),
);

export const repertoireCustomizationAtom = focusAtom(dataAtom, (o) =>
  o.prop("repertoire").valueOr({} as Repertoire),
);

export const classifierCustomizationAtom = focusAtom(dataAtom, (o) =>
  o.prop("classifier").valueOr({} as Classifier),
);

export const useGlyph = (char: string) => {
  const form = useAtomValue(formAtom);
  const customization = useAtomValue(formCustomizationAtom);
  return customization[char] || form[char];
};

export const useDisplay = () => {
  const form = useAtomValue(formAtom);
  const configdata = useAtomValue(dataAtom);
  const customizations = configdata?.form ?? {};

  return (char: string) => {
    if (char.includes("-")) return char.split("-")[1]!;
    if (!isPUA(char)) return char;
    const name = (customizations[char] || form[char])?.name;
    return name ?? "丢失的字根";
  };
};

export const useRepertoire = () => {
  const repertoire = useAtomValue(repertoireAtom);
  const customization = useAtomValue(repertoireCustomizationAtom);
  return { ...repertoire, ...customization };
};

export const useForm = () => {
  const form = useAtomValue(formAtom);
  const customization = useAtomValue(formCustomizationAtom);
  return { ...form, ...customization };
};

export const useCode = () => {
  const customization = useAtomValue(formCustomizationAtom);
  const maxCode = Math.max(
    ...Object.keys(customization).map((x) => x.codePointAt(0)!),
  );
  return Math.max(maxCode + 1, 0xf000);
};

export const useClassifier = () => {
  const customization = useAtomValue(classifierCustomizationAtom);
  return { ...defaultClassifier, ...customization };
};

export const useAll = () => {
  return {
    form: useForm(),
    repertoire: useRepertoire(),
    classifier: useClassifier(),
  };
};
