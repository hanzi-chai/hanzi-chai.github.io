import { useAtomValue } from "jotai";
import { keyboardAtom, repertoireAtom, sequenceAtom } from "~/atoms";
import { Select, Display } from "./Utils";
import type { SelectProps } from "antd";
import type { ProFormSelectProps } from "@ant-design/pro-components";

interface ElementSelectProps extends SelectProps<string> {
  customFilter?: (s: string) => boolean;
  excludeGrouped?: boolean;
  includeOptional?: boolean;
  onlyRootsAndStrokes?: boolean;
}

export default function ElementSelect(
  props: ElementSelectProps & ProFormSelectProps,
) {
  const {
    customFilter,
    excludeGrouped,
    onlyRootsAndStrokes,
    includeOptional,
    ...rest
  } = props;
  const { mapping, grouping, optional } = useAtomValue(keyboardAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  const repertoire = useAtomValue(repertoireAtom);
  let keys = Object.keys(mapping).concat(Object.keys(grouping ?? {}));
  if (excludeGrouped) {
    keys = keys.filter((x) => grouping?.[x] === undefined);
  }
  if (onlyRootsAndStrokes) {
    keys = keys.filter((x) => repertoire[x] || x.match(/\d/));
  }
  if (includeOptional) {
    for (const key of Object.keys(optional ?? {})) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }
  if (customFilter) {
    keys = keys.filter(customFilter);
  }
  return (
    <Select
      {...rest}
      showSearch
      placeholder="输入笔画搜索"
      options={keys.map((x) => ({
        value: x,
        label: <Display name={x} />,
      }))}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const value = option.value;
        const sequence = sequenceMap.get(value);
        if (sequence !== undefined) {
          return sequence.startsWith(input);
        }
        return value.includes(input);
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
