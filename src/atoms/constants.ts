import { useAtomValue } from "jotai";
import { formAtom, repertoireAtom } from "./formRepertoire";
import { configDataAtom } from "./main";
import { isPUA } from "~/lib/utils";
import type { ComponentGlyph, CompoundGlyph } from "~/lib/data";
import defaultClassifier from "~/lib/classifier";

export const useGlyph = (char: string) => {
  const form = useAtomValue(formAtom);
  const configdata = useAtomValue(configDataAtom);
  const customizations = configdata?.form ?? {};

  return customizations[char] || form[char];
};

export const useDisplay = () => {
  const form = useAtomValue(formAtom);
  const configdata = useAtomValue(configDataAtom);
  const customizations = configdata?.form ?? {};

  return (char: string) => {
    if (char.includes("-")) return char.split("-")[1]!;
    if (!isPUA(char)) return char;
    const name = (customizations[char] || form[char])?.name;
    return name ?? "丢失的字根";
  };
};

export const useComponent = (char: string) => {
  return useGlyph(char) as ComponentGlyph;
};

export const useCompound = (char: string) => {
  return useGlyph(char) as CompoundGlyph;
};

export const useRepertoire = () => {
  const repertoire = useAtomValue(repertoireAtom);
  const configdata = useAtomValue(configDataAtom);
  const customizations = configdata?.repertoire ?? {};

  return { ...repertoire, ...customizations };
};

export const useForm = () => {
  const form = useAtomValue(formAtom);
  const configdata = useAtomValue(configDataAtom);
  const customizations = configdata?.form ?? {};
  return { ...form, ...customizations };
};

export const useCode = () => {
  const configdata = useAtomValue(configDataAtom);
  const customizations = configdata?.form ?? {};
  const maxCode = Math.max(
    ...Object.keys(customizations).map((x) => x.codePointAt(0)!),
  );
  return Math.max(maxCode + 1, 0xf000);
};

export const useClassifier = () => {
  const configdata = useAtomValue(configDataAtom);
  const customizations = configdata?.classifier ?? {};

  return { ...defaultClassifier, ...customizations };
};

export const useAll = () => {
  return {
    form: useForm(),
    repertoire: useRepertoire(),
    classifier: useClassifier(),
  };
};
