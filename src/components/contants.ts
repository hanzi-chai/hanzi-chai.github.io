import defaultClassifier from "~/lib/classifier";
import { isPUA, isValidChar } from "~/lib/utils";
import { useData } from "./context";
import type { ComponentGlyph, CompoundGlyph } from "~/lib/data";
import { selectForm, selectRepertoire, useAppSelector } from "./store";

const useGlyph = (char: string) => {
  const form = useAppSelector(selectForm);
  const customizations = useData()?.form ?? {};
  return customizations[char] || form[char];
};

const useDisplay = () => {
  const form = useAppSelector(selectForm);
  const customizations = useData()?.form ?? {};
  return (char: string) => {
    const glyph = customizations[char] || form[char];
    return isPUA(char) ? glyph?.name ?? "丢失的字根" : char;
  };
};

const useComponent = (char: string) => {
  return useGlyph(char) as ComponentGlyph;
};

const useCompound = (char: string) => {
  return useGlyph(char) as CompoundGlyph;
};

const useRepertoire = () => {
  const repertoire = useAppSelector(selectRepertoire);
  const customizations = useData()?.repertoire ?? {};
  return { ...repertoire, ...customizations };
};

const useForm = () => {
  const form = useAppSelector(selectForm);
  const customizations = useData()?.form ?? {};
  return { ...form, ...customizations };
};

const useCode = () => {
  const formCustomizations = useData()?.form ?? {};
  const maxCode = Math.max(
    ...Object.keys(formCustomizations).map((x) => x.codePointAt(0)!),
  );
  return Math.max(maxCode + 1, 0xf000);
};

const useClassifier = () => {
  const classifier = useData()?.classifier ?? {};
  return { ...defaultClassifier, ...classifier };
};

const useAll = () => {
  return {
    form: useForm(),
    repertoire: useRepertoire(),
    classifier: useClassifier(),
  };
};

export {
  useForm,
  useCode,
  useRepertoire,
  useClassifier,
  useAll,
  useGlyph,
  useComponent,
  useCompound,
  useDisplay,
};
