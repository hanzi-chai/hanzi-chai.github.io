import { useAtomValue } from "jotai";
import {
  字母表原子,
  如字库原子,
  决策原子,
  如笔顺映射原子,
  变量规则映射原子,
  useAtomValueUnwrapped,
} from "~/atoms";
import { DisplayWithSuperScript, Select } from "./Utils";
import type { BaseOptionType } from "antd/es/select";
import { type 广义码位, 是变量, 是归并 } from "~/lib";

export interface KeySelectProps {
  value: 广义码位;
  onChange: (k: 广义码位) => void;
  allowEmpty?: boolean;
  allowAlphabets?: boolean;
  allowElements?: boolean;
  allowVariables?: boolean;
  allowPlaceholder?: boolean;
}

// 有五种可能的 key 类型：
// 1. 字符串，表示字母表中的某个字母
// 2. 对象 { element: string, index: number }，表示映射到某个元素的第 index 个位置
// 3. 对象 { variable: string }，表示映射变量
// 4. null，表示占位符
// 5. 空字符串，表示无键位
export default function KeySelect({
  value,
  onChange,
  allowEmpty,
  allowAlphabets,
  allowElements,
  allowVariables,
  allowPlaceholder,
}: KeySelectProps) {
  const keyOptions: BaseOptionType[] = allowEmpty
    ? [{ label: "无", value: JSON.stringify("") }]
    : [];
  const alphabet = useAtomValue(字母表原子);
  const alphabetOptions = Array.from(alphabet).map((x) => ({
    label: x,
    value: JSON.stringify(x),
  }));
  if (allowAlphabets) keyOptions.push(...alphabetOptions);
  const mapping = useAtomValue(决策原子);
  const referenceOptions = Object.entries(mapping).flatMap(
    ([element, mapped]) => {
      if (是归并(mapped)) return [];
      const length = mapped.length;
      return [...Array(length).keys()].map((index) => ({
        label: <DisplayWithSuperScript name={element} index={index} />,
        value: JSON.stringify({ element, index }),
      }));
    },
  );
  if (allowElements) keyOptions.push(...referenceOptions);
  const variables = useAtomValue(变量规则映射原子);
  const variableOptions = Object.keys(variables).map((key) => ({
    label: key,
    value: JSON.stringify({ variable: key }),
  }));
  if (allowVariables) keyOptions.push(...variableOptions);
  if (allowPlaceholder)
    keyOptions.push({ label: "占位符", value: JSON.stringify(null) });
  const sequenceMap = useAtomValueUnwrapped(如笔顺映射原子);
  return (
    <Select
      showSearch
      placeholder="输入搜索"
      options={keyOptions}
      style={{ minWidth: 96 }}
      value={JSON.stringify(value)}
      onChange={(raw) => onChange(JSON.parse(raw))}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const key: 广义码位 = JSON.parse(option.value);
        if (typeof key === "string") {
          return key.includes(input);
        }
        if (key === null) {
          return "占位符".includes(input);
        }
        if ("variable" in key) {
          return key.variable.includes(input);
        }
        const sequence = sequenceMap.get(key.element);
        const 匹配序列 = sequence?.startsWith(input) ?? false;
        const 匹配元素 = key.element.includes(input);
        return 匹配序列 || 匹配元素;
      }}
      filterSort={(a, b) => {
        const ak: 广义码位 = JSON.parse(a.value);
        const bk: 广义码位 = JSON.parse(b.value);
        if (ak === null) return -1;
        if (bk === null) return 1;
        if (是变量(ak) && 是变量(bk)) {
          return ak.variable.localeCompare(bk.variable);
        }
        if (是变量(ak)) return -1;
        if (是变量(bk)) return 1;
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
