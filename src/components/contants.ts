import { createContext, useContext } from "react";
import defaultClassifier from "~/lib/classifier";
import { displayName } from "~/lib/utils";
import { useData } from "./context";
import { ComponentGlyph, CompoundGlyph, Form, Repertoire } from "~/lib/data";
import { selectForm, selectRepertoire, useAppSelector } from "./store";

const useGlyph = (char: string) => {
  const form = useAppSelector(selectForm);
  return useData().form[char] || form[char];
};

const useDisplay = () => {
  const form = useAppSelector(selectForm);
  const formCustomized = useData().form;
  return (char: string) => {
    const glyph = formCustomized[char] || form[char];
    return displayName(char, glyph)!;
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
  return Object.assign({}, repertoire, useData().repertoire);
};

const useForm = () => {
  const form = useAppSelector(selectForm);
  return Object.assign({}, form, useData().form);
};

const useCode = () => {
  const formCustomizations = useData().form;
  const maxCode = Math.max(
    ...Object.keys(formCustomizations).map((x) => x.codePointAt(0)!),
  );
  return Math.max(maxCode + 1, 0xf000);
};

const useClassifier = () => {
  const { classifier } = useData();
  return Object.assign({}, defaultClassifier, classifier);
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
