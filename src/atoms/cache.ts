import { atom } from "jotai";
import type {
  AnalysisConfig,
  AnalysisResult,
  AssemblyResult,
  EncodeResult,
  Metric,
  PronunciationElementTypes,
} from "~/lib";
import { applyRules, defaultAlgebra } from "~/lib";
import {
  algebraAtom,
  analysisAtom,
  charactersAtom,
  configAtom,
  dictionaryAtom,
  encoderAtom,
  groupingAtom,
  keyboardAtom,
  mappingAtom,
  meaningfulObjectiveAtom,
  repertoireAtom,
} from ".";
import { assetsAtom, customElementsAtom } from "./assets";
import { thread } from "./utils";

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
  const config = { algebra, encoder, keyboard };
  return await thread.spawn<AssemblyResult>("assembly", [
    repertoire,
    config,
    characters,
    dictionary,
    analysisResult,
    customElements,
  ]);
});

export const encodeResultAtom = atom(async (get) => {
  const objective = get(meaningfulObjectiveAtom);
  const config = get(configAtom);
  const assemblyResult = await get(assemblyResultAtom);
  const assets = await get(assetsAtom);
  return await thread.spawn<[EncodeResult, Metric]>("encode", [
    objective,
    config.info.name,
    assemblyResult[0],
    assets.pair_equivalence,
  ]);
});
