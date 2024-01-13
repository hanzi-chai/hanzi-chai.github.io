import { useAtom, useAtomValue } from "jotai";
import {
  alphabetAtom,
  keyboardsAtom,
  determinedRepertoireAtom,
  displayAtom,
  mappingAtom,
  sequenceAtom,
} from "~/atoms";
import { Select, renderSuperScript } from "./Utils";
import { Key } from "~/lib/config";

export interface KeySelectProps {
  value: Key;
  onChange: (k: Key) => void;
  allowEmpty?: boolean;
}

export default function KeySelect({
  value,
  onChange,
  allowEmpty,
}: KeySelectProps) {
  const alphabet = useAtomValue(alphabetAtom);
  const alphabetOptions = Array.from(alphabet).map((x) => ({
    label: x,
    value: JSON.stringify(x),
  }));
  const allOptions = [{ label: "无", value: JSON.stringify("") }].concat(
    alphabetOptions,
  );
  const keyOptions = allowEmpty ? allOptions : alphabetOptions;
  const mapping = useAtomValue(mappingAtom);
  const display = useAtomValue(displayAtom);
  const referenceOptions = Object.entries(mapping)
    .map(([element, mapped]) => {
      const length = mapped.length;
      return [...Array(length).keys()].map((index) => ({
        label: renderSuperScript(display(element), index),
        value: JSON.stringify({ element, index }),
      }));
    })
    .flat();
  const sequenceMap = useAtomValue(sequenceAtom);
  const form = useAtomValue(determinedRepertoireAtom);
  return (
    <Select
      style={{ width: 64 }}
      showSearch
      placeholder="输入笔画搜索"
      options={keyOptions.concat(referenceOptions)}
      value={JSON.stringify(value)}
      onChange={(raw) => onChange(JSON.parse(raw))}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const key: Key = JSON.parse(option.value);
        if (typeof key === "string") {
          return key.includes(input);
        } else {
          if (form[key.element] !== undefined) {
            return sequenceMap.get(key.element)?.startsWith(input) ?? false;
          } else {
            return key.element.includes(input);
          }
        }
      }}
      filterSort={(a, b) => {
        return (
          Number(alphabet.includes(b.value)) -
          Number(alphabet.includes(a.value))
        );
      }}
    />
  );
}
