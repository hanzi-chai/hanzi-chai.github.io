import { useAtomValue } from "jotai";
import {
  alphabetAtom,
  repertoireAtom,
  displayAtom,
  mappingAtom,
  sequenceAtom,
  mappingGeneratorAtom,
} from "~/atoms";
import { DisplayWithSuperScript, Select } from "./Utils";
import { isMerge, type GeneratorKey, type Key } from "~/lib";
import type { BaseOptionType } from "antd/es/select";

export interface KeySelectProps {
  value: Key | GeneratorKey;
  onChange: (k: Key | GeneratorKey) => void;
  allowEmpty?: boolean;
  disableAlphabets?: boolean;
  disableElements?: boolean;
}

export default function KeySelect({
  value,
  onChange,
  allowEmpty,
  disableAlphabets,
  disableElements,
}: KeySelectProps) {
  const keyOptions: BaseOptionType[] = allowEmpty
    ? [{ label: "无", value: JSON.stringify("") }]
    : [];
  const alphabet = useAtomValue(alphabetAtom);
  const alphabetOptions = Array.from(alphabet).map((x) => ({
    label: x,
    value: JSON.stringify(x),
  }));
  if (!disableAlphabets) keyOptions.push(...alphabetOptions);
  const mapping = useAtomValue(mappingAtom);
  const referenceOptions = Object.entries(mapping).flatMap(
    ([element, mapped]) => {
      if (isMerge(mapped)) return [];
      const length = mapped.length;
      return [...Array(length).keys()].map((index) => ({
        label: <DisplayWithSuperScript name={element} index={index} />,
        value: JSON.stringify({ element, index }),
      }));
    },
  );
  if (!disableElements) keyOptions.push(...referenceOptions);
  const generator = useAtomValue(mappingGeneratorAtom);
  const generatorOptions = generator.map(({ name }) => ({
    label: name,
    value: JSON.stringify({ generator: name }),
  }));
  keyOptions.push(...generatorOptions);
  const sequenceMap = useAtomValue(sequenceAtom);
  const form = useAtomValue(repertoireAtom);
  return (
    <Select
      showSearch
      placeholder="输入笔画搜索"
      options={keyOptions}
      value={JSON.stringify(value)}
      onChange={(raw) => onChange(JSON.parse(raw))}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const key: Key | GeneratorKey = JSON.parse(option.value);
        if (typeof key === "string") {
          return key.includes(input);
        }
        if ("generator" in key) {
          return key.generator.includes(input);
        }
        if (form[key.element] !== undefined) {
          return sequenceMap.get(key.element)?.startsWith(input) ?? false;
        }
        return key.element.includes(input);
      }}
      filterSort={(a, b) => {
        const ak: Key | GeneratorKey = JSON.parse(a.value);
        const bk: Key | GeneratorKey = JSON.parse(b.value);
        if (typeof ak === "string" && typeof bk === "string") {
          return ak.localeCompare(bk);
        }
        if (typeof ak === "string") {
          return -1;
        }
        if (typeof bk === "string") {
          return 1;
        }
        if ("generator" in ak && "generator" in bk) {
          return ak.generator.localeCompare(bk.generator);
        }
        if ("generator" in ak) {
          return -1;
        }
        if ("generator" in bk) {
          return 1;
        }
        const amapped = sequenceMap.get(ak.element) ?? "";
        const bmapped = sequenceMap.get(bk.element) ?? "";
        return amapped.localeCompare(bmapped);
      }}
    />
  );
}
