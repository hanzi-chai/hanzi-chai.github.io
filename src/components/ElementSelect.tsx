import { type 元素, 字符, 笔画 } from "hanzi-chai";
import { useAtomValue } from "jotai";
import {
  useAtomValueUnwrapped,
  全部合法元素原子,
  如笔顺映射原子,
  强类型决策原子,
  强类型决策空间原子,
} from "~/atoms";
import { ElementDisplay, Select } from "./Utils";

interface ElementSelectProps {
  value: 元素;
  onChange: (e: 元素) => void;
  includeOptional?: boolean;
  onlyRootsAndStrokes?: boolean; // 仅显示字根和笔画
}

export default function ElementSelect(
  props: ElementSelectProps & { className?: string; allowClear?: boolean },
) {
  const { value, onChange, onlyRootsAndStrokes, includeOptional, ...rest } =
    props;
  const 决策 = useAtomValue(强类型决策原子);
  const 决策空间 = useAtomValue(强类型决策空间原子);
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  const { 名称映射 } = useAtomValueUnwrapped(全部合法元素原子);
  let 全部元素 = [...new Set([...决策.keys(), ...决策空间.keys()])];
  全部元素.sort((a, b) => a.获取名称().localeCompare(b.获取名称()));
  if (!includeOptional) {
    全部元素 = 全部元素.filter((x) => 决策.get(x) !== undefined);
  }
  if (onlyRootsAndStrokes) {
    全部元素 = 全部元素.filter((x) => x instanceof 字符 || x instanceof 笔画);
  }
  return (
    <Select
      value={value.获取名称()}
      onChange={(s) => {
        const 元素 = 名称映射.get(s);
        if (元素) onChange(元素);
      }}
      showSearch
      placeholder="输入元素名称或笔画搜索"
      options={全部元素.map((v) => ({
        value: v.获取名称(),
        label: <ElementDisplay element={v} />,
      }))}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const 元素 = 名称映射.get(option.value);
        if (!元素) return false;
        const 匹配序列 =
          元素 instanceof 字符 &&
          笔顺映射.get(元素)?.some((s) => s.startsWith(input));
        const 匹配元素 = option.value.includes(input);
        return 匹配序列 || 匹配元素;
      }}
      filterSort={(a, b) => {
        const cha = 名称映射.get(a.value);
        const chb = 名称映射.get(b.value);
        if (cha instanceof 字符 && chb instanceof 字符) {
          const seqa = 笔顺映射.get(cha)?.[0] ?? "";
          const seqb = 笔顺映射.get(chb)?.[0] ?? "";
          return seqa.length - seqb.length;
        }
        return a.value.localeCompare(b.value);
      }}
      {...rest}
    />
  );
}
