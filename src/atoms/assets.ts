import { atomWithStorage } from "jotai/utils";
import type {
  CustomElementMap,
  Dictionary,
  Distribution,
  Equivalence,
  Frequency,
} from "~/lib";
import { MiniDb } from "jotai-minidb";
import { atom } from "jotai";
import {
  adapt,
  getDictFromTSV,
  getDistributionFromTSV,
  getRecordFromTSV,
  stringifySequence,
  type PrimitiveRepertoire,
} from "~/lib";
import { charactersAtom } from "./data";
import { configAtom } from "./config";
import { assemblyResultAtom } from "./cache";
import pako from "pako";

const _cache: Record<string, any> = {};

export async function fetchAsset(filename: string) {
  // 检查缓存
  if (filename in _cache) {
    return _cache[filename];
  }
  try {
    const response = await fetch(`/cache/${filename}`);
    if (!response.ok) {
      throw new Error(`获取资源失败: ${filename}, 状态码: ${response.status}`);
    }
    let result: any;
    if (filename.endsWith(".deflate")) {
      result = await handleCompressedFile(filename, response);
    } else if (filename.endsWith(".json")) {
      result = await response.json();
    } else {
      result = await response.text();
    }
    // 缓存结果
    _cache[filename] = result;
    return result;
  } catch (error) {
    console.error(`处理资源时出错: ${filename}`, error);
    throw error;
  }
}

async function handleCompressedFile(filename: string, response: Response) {
  const name = filename.replace(/\.deflate$/, "");
  const arrayBuffer = await response.arrayBuffer();
  try {
    const content = pako.inflate(arrayBuffer, { to: "string" });
    if (name.endsWith(".json")) {
      try {
        return JSON.parse(content);
      } catch (error) {
        throw new Error(`解析JSON文件失败: ${name}`);
      }
    }
  } catch (error) {
    throw new Error(`解压文件失败: ${name}`);
  }
}

export const primitiveRepertoireAtom = atom<PrimitiveRepertoire>({});
primitiveRepertoireAtom.debugLabel = "repertoire";

export const defaultDictionaryAtom = atom<Promise<Dictionary>>(async () =>
  getDictFromTSV(await fetchAsset("dictionary.txt")),
);
export const frequencyAtom = atom<Promise<Frequency>>(async () =>
  getRecordFromTSV(await fetchAsset("frequency.txt")),
);
export const keyDistributionAtom = atom<Promise<Distribution>>(async () =>
  getDistributionFromTSV(await fetchAsset("key_distribution.txt")),
);
export const pairEquivalenceAtom = atom<Promise<Equivalence>>(async () =>
  getRecordFromTSV(await fetchAsset("pair_equivalence.txt")),
);

export const inputAtom = atom(async (get) => {
  const key_distribution =
    get(userKeyDistributionAtom) ?? (await get(keyDistributionAtom));
  const pair_equivalence =
    get(userPairEquivalenceAtom) ?? (await get(pairEquivalenceAtom));
  const config = get(configAtom);
  const assemblyResult = stringifySequence(await get(assemblyResultAtom));
  return {
    配置: config,
    词列表: assemblyResult,
    原始键位分布信息: key_distribution,
    原始当量信息: pair_equivalence,
  };
});

export const adaptedFrequencyAtom = atom(async (get) => {
  const frequency = get(userFrequencyAtom) ?? (await get(frequencyAtom));
  const characters = get(charactersAtom);
  const dictionary = await get(dictionaryAtom);
  const words = new Set(characters);
  dictionary.forEach(([word]) => words.add(word));
  return adapt(frequency, words);
});

export const dictionaryAtom = atom(async (get) => {
  return get(userDictionaryAtom) ?? (await get(defaultDictionaryAtom));
});

const db = new MiniDb<Dictionary>();

export const userCharacterSetAtom = atomWithStorage<string[] | undefined>(
  "user_character_set",
  undefined,
);

export const userFrequencyAtom = atomWithStorage<Frequency | undefined>(
  "user_frequency",
  undefined,
);

export const userDictionaryAtom = db.item("user_dictionary");

export const userKeyDistributionAtom = atomWithStorage<
  Distribution | undefined
>("user_key_distribution", undefined);

export const userPairEquivalenceAtom = atomWithStorage<Equivalence | undefined>(
  "user_pair_equivalence",
  undefined,
);

export const customElementsAtom = atomWithStorage<
  Record<string, CustomElementMap>
>("custom_elements", {});

export const processedCustomElementsAtom = atom((get) => {
  const customElements = get(customElementsAtom);
  const content = new Map<string, string[]>(
    Object.entries(customElements).map(([name, map]) => {
      const set = new Set(Object.values(map).flat());
      return [name, [...set].sort().map((x) => `${name}-${x}`)];
    }),
  );
  return content;
});
