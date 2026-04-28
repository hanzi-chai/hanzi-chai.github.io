import type { ProFormSelectProps } from "@ant-design/pro-components";
import type { SelectProps } from "antd";
import { useAtomValue } from "jotai";
import {
  useAtomValueUnwrapped,
  决策原子,
  决策空间原子,
  原始字库原子,
  如笔顺映射原子,
} from "~/atoms";
import { Display, Select } from "./Utils";

interface ElementSelectProps extends SelectProps<string> {
  customFilter?: (s: string) => boolean;
  includeOptional?: boolean;
  onlyRootsAndStrokes?: boolean;
}

export default function ElementSelect(
  props: ElementSelectProps & ProFormSelectProps,
) {
  const { customFilter, onlyRootsAndStrokes, includeOptional, ...rest } = props;
  const mapping = useAtomValue(决策原子);
  const mapping_space = useAtomValue(决策空间原子);
  const sequenceMap = useAtomValueUnwrapped(如笔顺映射原子);
  const 原始字库 = useAtomValue(原始字库原子);
  let keys = Object.keys(mapping);
  if (onlyRootsAndStrokes) {
    keys = keys.filter((x) => 原始字库.校验(x) || x.match(/\d/));
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
        label: 原始字库.校验(x) ? (
          <Display name={原始字库.校验(x)!.character} />
        ) : (
          x
        ),
      }))}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const value = option.value;
        const ch = 原始字库.校验(value);
        if (!ch) return false;
        const sequence = sequenceMap.get(ch.character);
        if (sequence !== undefined) {
          return sequence.startsWith(input);
        }
        return value.includes(input);
      }}
      filterSort={(a, b) => {
        const cha = 原始字库.校验(a.value);
        const chb = 原始字库.校验(b.value);
        if (!cha || !chb) {
          return a.value.localeCompare(b.value);
        }
        return (
          (sequenceMap.get(cha.character) ?? "").length -
          (sequenceMap.get(chb.character) ?? "").length
        );
      }}
    />
  );
}
