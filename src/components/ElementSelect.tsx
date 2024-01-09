import { useAtomValue } from "jotai";
import {
  configFormAtom,
  determinedRepertoireAtom,
  displayAtom,
  sequenceAtom,
} from "~/atoms";
import { Select } from "./Utils";

export interface ElementSelectProps {
  char?: string;
  onChange: (s: string) => void;
  customFilter?: (s: string) => boolean;
  excludeGrouped?: boolean;
  onlyRootsAndStrokes?: boolean;
}

export default function ElementSelect({
  char,
  onChange,
  customFilter,
  excludeGrouped,
  onlyRootsAndStrokes,
}: ElementSelectProps) {
  const { mapping, grouping } = useAtomValue(configFormAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  const form = useAtomValue(determinedRepertoireAtom);
  let keys = Object.keys(mapping).concat(Object.keys(grouping));
  if (excludeGrouped) {
    keys = keys.filter((x) => grouping[x] === undefined);
  }
  if (onlyRootsAndStrokes) {
    keys = keys.filter((x) => form[x] || x.match(/\d/));
  }
  if (customFilter) {
    keys = keys.filter(customFilter);
  }
  const display = useAtomValue(displayAtom);
  return (
    <Select
      showSearch
      placeholder="输入笔画搜索"
      options={keys.map((x) => ({
        value: x,
        label: display(x),
      }))}
      value={char}
      onChange={onChange}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const value = option.value;
        if (form[value] !== undefined) {
          return sequenceMap.get(value)!.startsWith(input);
        } else {
          return value.includes(input);
        }
      }}
      filterSort={(a, b) => {
        return (
          (sequenceMap.get(a.value) ?? "").length -
          (sequenceMap.get(b.value) ?? "").length
        );
      }}
    />
  );
}
