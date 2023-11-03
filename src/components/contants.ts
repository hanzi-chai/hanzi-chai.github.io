import { createContext, useContext } from "react";
import defaultClassifier from "~/lib/classifier";
import { displayName } from "~/lib/utils";
import { useData } from "./context";
import {
  ComponentGlyph,
  CompoundGlyph,
  Form,
  Repertoire,
  SliceGlyph,
} from "~/lib/data";

export const FormContext = createContext<Form>({});
export const RepertoireContext = createContext<Repertoire>({});

const useGlyph = (char: string) => {
  const form = useContext(FormContext);
  return useData().form[char] || form[char];
};

const useDisplay = () => {
  const form = useContext(FormContext);
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

const useSlice = (char: string) => {
  return useGlyph(char) as SliceGlyph;
};

const useRepertoire = () => {
  const repertoire = useContext(RepertoireContext);
  return Object.assign({}, repertoire, useData().repertoire);
};

const useForm = () => {
  const form = useContext(FormContext);
  return Object.assign({}, form, useData().form);
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
  useRepertoire,
  useClassifier,
  useAll,
  useGlyph,
  useComponent,
  useCompound,
  useSlice,
  useDisplay,
};
