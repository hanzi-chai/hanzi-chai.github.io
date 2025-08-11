import { atom } from "jotai";
import type {
  AnalysisConfig,
  AnalysisResult,
  Assembly,
  AssemblyResult,
  DictEntry,
  EncodeResult,
  Metric,
  PronunciationElementTypes,
} from "~/lib";
import { applyRules, defaultAlgebra } from "~/lib";
import {
  algebraAtom,
  analysisAtom,
  charactersAtom,
  dictionaryAtom,
  encoderAtom,
  groupingAtom,
  keyboardAtom,
  mappingAtom,
  mappingSpaceAtom,
  mappingTypeAtom,
  meaningfulObjectiveAtom,
  priorityShortCodesAtom,
  repertoireAtom,
} from ".";
import { adaptedFrequencyAtom, customElementsAtom, inputAtom } from "./assets";
import { thread } from "./utils";

const mergedAlgebraAtom = atom((get) => {
  const algebra = get(algebraAtom);
  return { ...algebra, ...defaultAlgebra };
});

export const phonemeEnumerationAtom = atom((get) => {
  const repertoire = get(repertoireAtom);
  const syllables = [
    ...new Set(
      Object.values(repertoire).flatMap((x) => x.readings.map((y) => y.pinyin)),
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

export const analysisConfigAtom = atom(async (get) => {
  const repertoire = get(repertoireAtom);
  const mappingSpace = get(mappingSpaceAtom);
  const analysisConfig: AnalysisConfig = {
    analysis: get(analysisAtom),
    primaryRoots: new Map(
      Object.entries(get(mappingAtom)).filter(([x]) => repertoire[x]),
    ),
    secondaryRoots: new Map(
      Object.entries(get(groupingAtom)).filter(([x]) => repertoire[x]),
    ),
    optionalRoots: new Set(
      Object.entries(mappingSpace)
        .filter(([_, v]) => v.some((x) => x.value == null))
        .map(([k, v]) => k),
    ),
  };
  return analysisConfig;
});

export const analysisResultAtom = atom(async (get) => {
  const repertoire = get(repertoireAtom);
  const analysisConfig = await get(analysisConfigAtom);
  const characters = get(charactersAtom);
  return await thread.spawn<AnalysisResult>("analysis", [
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
  const priority = get(priorityShortCodesAtom);
  const adaptedFrequency = await get(adaptedFrequencyAtom);
  const config = { algebra, encoder, keyboard, priority };
  return await thread.spawn<AssemblyResult>("assembly", [
    repertoire,
    config,
    characters,
    dictionary,
    adaptedFrequency,
    analysisResult,
    customElements,
  ]);
});

export const encodeResultAtom = atom(async (get) => {
  const objective = get(meaningfulObjectiveAtom);
  const input = await get(inputAtom);
  return await thread.spawn<[EncodeResult, Metric]>("encode", [
    input,
    objective,
  ]);
});

export interface Combined extends Assembly, DictEntry {}

export const combinedResultAtom = atom(async (get) => {
  const assemblyResult = await get(assemblyResultAtom);
  const [encodeResult] = await get(encodeResultAtom);
  const combined: Combined[] = assemblyResult.map((x, i) => ({
    ...x,
    ...encodeResult[i]!,
  }));
  return combined;
});
