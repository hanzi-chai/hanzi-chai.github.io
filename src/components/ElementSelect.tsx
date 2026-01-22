import { useAtomValue } from "jotai";
import { 键盘原子, 如字库原子, 如笔顺映射原子 } from "~/atoms";
import { Select, Display } from "./Utils";
import type { SelectProps } from "antd";
import type { ProFormSelectProps } from "@ant-design/pro-components";

interface ElementSelectProps extends SelectProps<string> {
  customFilter?: (s: string) => boolean;
  includeOptional?: boolean;
  onlyRootsAndStrokes?: boolean;
}

export default function ElementSelect(
  props: ElementSelectProps & ProFormSelectProps,
) {
  const { customFilter, onlyRootsAndStrokes, includeOptional, ...rest } = props;
  const { mapping, mapping_space } = useAtomValue(键盘原子);
  const sequenceMap = useAtomValue(如笔顺映射原子);
  const repertoire = useAtomValue(如字库原子);
  let keys = Object.keys(mapping);
  if (onlyRootsAndStrokes) {
    keys = keys.filter((x) => repertoire[x] || x.match(/\d/));
  }
  if (includeOptional) {
    for (const key of Object.keys(mapping_space ?? {})) {
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
