import { useAtomValue } from "jotai";
import {
  alphabetAtom,
  repertoireAtom,
  mappingAtom,
  sequenceAtom,
  mappingVariablesAtom,
} from "~/atoms";
import { DisplayWithSuperScript, Select } from "./Utils";
import { isMerge, GeneralizedKey, isVariableKey } from "~/lib";
import type { BaseOptionType } from "antd/es/select";

export interface KeySelectProps {
  value: GeneralizedKey;
  onChange: (k: GeneralizedKey) => void;
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
  const variables = useAtomValue(mappingVariablesAtom);
  const variableOptions = Object.keys(variables).map((key) => ({
    label: key,
    value: JSON.stringify({ variable: key }),
  }));
  keyOptions.push(...variableOptions);
  keyOptions.push({ label: "占位符", value: JSON.stringify(null) });
  const sequenceMap = useAtomValue(sequenceAtom);
  const form = useAtomValue(repertoireAtom);
  return (
    <Select
      showSearch
      placeholder="输入笔画搜索"
      options={keyOptions}
      style={{ minWidth: 96 }}
      value={JSON.stringify(value)}
      onChange={(raw) => onChange(JSON.parse(raw))}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const key: GeneralizedKey = JSON.parse(option.value);
        if (typeof key === "string") {
          return key.includes(input);
        }
        if (key === null) {
          return "占位符".includes(input);
        }
        if ("variable" in key) {
          return key.variable.includes(input);
        }
        if (form[key.element] !== undefined) {
          return sequenceMap.get(key.element)?.startsWith(input) ?? false;
        }
        return key.element.includes(input);
      }}
      filterSort={(a, b) => {
        const ak: GeneralizedKey = JSON.parse(a.value);
        const bk: GeneralizedKey = JSON.parse(b.value);
        if (ak === null) return -1;
        if (bk === null) return 1;
        if (isVariableKey(ak) && isVariableKey(bk)) {
          return ak.variable.localeCompare(bk.variable);
        }
        if (isVariableKey(ak)) return -1;
        if (isVariableKey(bk)) return 1;
        if (typeof ak === "string" && typeof bk === "string") {
          return ak.localeCompare(bk);
        }
        if (typeof ak === "string") {
          return -1;
        }
        if (typeof bk === "string") {
          return 1;
        }
        const amapped = sequenceMap.get(ak.element) ?? "";
        const bmapped = sequenceMap.get(bk.element) ?? "";
        return amapped.localeCompare(bmapped);
      }}
    />
  );
}
