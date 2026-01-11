import { atom } from "jotai";
import type {
  AnalysisConfig,
  AnalysisResult,
  组装,
  组装结果,
  DictEntry,
  EncodeResult,
  Metric,
  PronunciationElementTypes,
  Value,
} from "~/lib";
import { applyRules, defaultAlgebra, isMerge } from "~/lib";
import {
  algebraAtom,
  analysisAtom,
  charactersAtom,
  customClassifierAtom,
  dictionaryAtom,
  encoderAtom,
  keyboardAtom,
  mappingAtom,
  mappingSpaceAtom,
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
  const mapping = get(mappingAtom);
  const mappingSpace = get(mappingSpaceAtom);
  const optionalRoots = new Set<string>();
  const classifier = get(customClassifierAtom);
  for (const [key, value] of Object.entries(mappingSpace)) {
    if (value.some((x) => x.value == null) || mapping[key] === undefined) {
      optionalRoots.add(key);
    }
  }
  const analysis = get(analysisAtom);
  const roots = new Map(Object.entries(mapping).filter(([x]) => repertoire[x]));
  if (analysis.serializer === "feihua") {
    for (const root of roots.keys()) {
      // e43d: 全字头、e0e3: 乔字底、e0ba: 亦字底无八、e439: 见二、e431: 聿三、e020: 负字头、e078：卧人、e03e：尚字头、e42d：学字头、e07f：荒字底、e02a：周字框、e087：木无十、f001: 龰字底、e41a：三竖、e001: 两竖、e17e: 西字心
      if (
        !/[12345二\ue001三\ue41a口八丷\ue087宀日人\ue43d\uf001十乂亠厶冂\ue439\ue02a儿\ue17e\ue0e3\ue0ba大小\ue03e\ue442川彐\ue431\ue020\ue078\ue42d\ue07f]/.test(
          root,
        )
      ) {
        optionalRoots.add(root);
      }
    }
  }
  const analysisConfig: AnalysisConfig = {
    analysis,
    roots,
    optionalRoots,
    classifier,
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
  const algebra = get(mergedAlgebraAtom);
  const encoder = get(encoderAtom);
  const keyboard = get(keyboardAtom);
  const characters = get(charactersAtom);
  const dictionary = await get(dictionaryAtom);
  const analysisResult = await get(analysisResultAtom);
  const customElements = get(customElementsAtom);
  const priority = get(priorityShortCodesAtom);
  const adaptedFrequency = await get(adaptedFrequencyAtom);
  const config = { algebra, encoder, keyboard, priority };
  return await thread.spawn<组装结果>("assembly", [
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

export interface Combined extends 组装, DictEntry {}

export const combinedResultAtom = atom(async (get) => {
  const assemblyResult = await get(assemblyResultAtom);
  const [encodeResult] = await get(encodeResultAtom);
  const combined: Combined[] = assemblyResult.map((x, i) => ({
    ...x,
    ...encodeResult[i]!,
  }));
  return combined;
});
