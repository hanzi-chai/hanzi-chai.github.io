import type { SelectProps } from "antd";
import { 单笔, 字符 } from "hanzi-chai";
import { useAtomValue } from "jotai";
import {
  useAtomValueUnwrapped,
  决策原子,
  如笔顺映射原子,
  强类型元素列表原子,
} from "~/atoms";
import { ElementDisplay, Select } from "./Utils";

interface ElementSelectProps extends SelectProps<string> {
  customFilter?: (s: string) => boolean;
  includeOptional?: boolean;
  onlyRootsAndStrokes?: boolean; // 仅显示字根和笔画
}

export default function ElementSelect(props: ElementSelectProps) {
  const { customFilter, onlyRootsAndStrokes, includeOptional, ...rest } = props;
  const 决策 = useAtomValue(决策原子);
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  const 强类型元素列表 = useAtomValue(强类型元素列表原子);
  let 名称与元素列表 = [...强类型元素列表];
  if (!includeOptional) {
    名称与元素列表 = 名称与元素列表.filter(([k]) => 决策[k] !== undefined);
  }
  if (onlyRootsAndStrokes) {
    名称与元素列表 = 名称与元素列表.filter(
      ([_, v]) => v instanceof 字符 || v instanceof 单笔,
    );
  }
  if (customFilter) {
    名称与元素列表 = 名称与元素列表.filter(([k]) => customFilter(k));
  }
  return (
    <Select
      {...rest}
      showSearch
      placeholder="输入元素名称或笔画搜索"
      options={名称与元素列表.map(([k, v]) => ({
        value: k,
        label: <ElementDisplay element={v} />,
      }))}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const 元素 = 强类型元素列表.get(option.value);
        if (!元素) return false;
        const 匹配序列 =
          元素 instanceof 字符 &&
          笔顺映射.get(元素)?.some((s) => s.startsWith(input));
        const 匹配元素 = option.value.includes(input);
        return 匹配序列 || 匹配元素;
      }}
      filterSort={(a, b) => {
        const cha = 强类型元素列表.get(a.value);
        const chb = 强类型元素列表.get(b.value);
        if (cha instanceof 字符 && chb instanceof 字符) {
          const seqa = 笔顺映射.get(cha)?.[0] ?? "";
          const seqb = 笔顺映射.get(chb)?.[0] ?? "";
          return seqa.length - seqb.length;
        }
        return a.value.localeCompare(b.value);
      }}
    />
  );
}
