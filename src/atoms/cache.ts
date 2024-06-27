import { atom } from "jotai";
import type {
  AnalysisConfig,
  AssemblyResult,
  PronunciationElementTypes,
} from "~/lib";
import { applyRules, defaultAlgebra } from "~/lib";
import type { AnalysisResult } from "~/lib";
import type { EncodeResult } from ".";
import {
  Thread,
  algebraAtom,
  analysisAtom,
  charactersAtom,
  dictionaryAtom,
  encoderAtom,
  groupingAtom,
  keyboardAtom,
  mappingAtom,
  repertoireAtom,
} from ".";
import { customElementsAtom } from "./assets";

const mergedAlgebraAtom = atom((get) => {
  const algebra = get(algebraAtom);
  return { ...algebra, ...defaultAlgebra };
});

export const phonemeEnumerationAtom = atom((get) => {
  const repertoire = get(repertoireAtom);
  const syllables = [
    ...new Set(
      Object.values(repertoire)
        .map((x) => x.readings.map((y) => y.pinyin))
        .flat(),
    ),
  ];
  const mergedAlgebras = Object.entries(get(mergedAlgebraAtom));
  const content: Map<PronunciationElementTypes, string[]> = new Map(
    mergedAlgebras.map(([name, rules]) => {
      const list = [
        ...new Set(syllables.map((s) => applyRules(name, rules, s))),
      ].sort();
      return [name as PronunciationElementTypes, list];
    }),
  );
  return content;
});

const jsThread = new Thread("js");

export const analysisResultAtom = atom(async (get) => {
  const repertoire = get(repertoireAtom);
  const analysisConfig: AnalysisConfig = {
    analysis: get(analysisAtom),
    primaryRoots: new Set(
      Object.keys(get(mappingAtom)).filter((x) => repertoire[x]),
    ),
    secondaryRoots: new Set(
      Object.keys(get(groupingAtom)).filter((x) => repertoire[x]),
    ),
  };
  const characters = get(charactersAtom);
  return await jsThread.spawn<AnalysisResult>("analysis", [
    repertoire,
    analysisConfig,
    characters,
  ]);
});

export const assemblyResultAtom = atom(async (get) => {
  const repertoire = get(repertoireAtom);
  const algebra = get(algebraAtom);
  const encoder = get(encoderAtom);
  const keyboard = get(keyboardAtom);
  const characters = get(charactersAtom);
  const dictionary = await get(dictionaryAtom);
  const analysisResult = await get(analysisResultAtom);
  const customElements = get(customElementsAtom);
  const config = { algebra, encoder, keyboard };
  return await jsThread.spawn<AssemblyResult>("assembly", [
    repertoire,
    config,
    characters,
    dictionary,
    analysisResult,
    customElements,
  ]);
});

export const encodeResultAtom = atom<EncodeResult | null>(null);
