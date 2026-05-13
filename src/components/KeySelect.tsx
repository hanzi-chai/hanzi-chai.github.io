import type { BaseOptionType } from "antd/es/select";
import {
  字符,
  type 广义码位,
  type 强类型广义引用,
  是变量,
  是强类型归并,
} from "hanzi-chai";
import { useAtomValue } from "jotai";
import {
  useAtomValueUnwrapped,
  全部合法元素原子,
  变量规则映射原子,
  如笔顺映射原子,
  字母表原子,
  强类型决策原子,
} from "~/atoms";
import { ElementPositionDisplay, Select } from "./Utils";

export interface KeySelectProps {
  value: 强类型广义引用;
  onChange: (k: 强类型广义引用) => void;
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
  const mapping = useAtomValue(强类型决策原子);
  const { 名称映射 } = useAtomValueUnwrapped(全部合法元素原子);
  const referenceOptions = [...mapping].flatMap(([element, mapped]) => {
    if (是强类型归并(mapped)) return [];
    const length = mapped.length;
    return [...Array(length).keys()].map((index) => ({
      label: <ElementPositionDisplay element={element} index={index} />,
      value: JSON.stringify({ element: element.获取名称(), index }),
    }));
  });
  if (allowElements) keyOptions.push(...referenceOptions);
  const variables = useAtomValue(变量规则映射原子);
  const variableOptions = Object.keys(variables).map((key) => ({
    label: key,
    value: JSON.stringify({ variable: key }),
  }));
  if (allowVariables) keyOptions.push(...variableOptions);
  if (allowPlaceholder)
    keyOptions.push({ label: "占位符", value: JSON.stringify(null) });
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  return (
    <Select
      showSearch
      placeholder="输入搜索"
      options={keyOptions}
      className="min-w-24"
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
        const 元素 = 名称映射.get(key.element);
        if (!元素) return false;
        const 匹配序列 =
          元素 instanceof 字符 &&
          笔顺映射.get(元素)?.some((s) => s.startsWith(input));
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
        const cha = 名称映射.get(ak.element);
        const chb = 名称映射.get(bk.element);
        if (cha instanceof 字符 && chb instanceof 字符) {
          const aSequence = 笔顺映射.get(cha)?.[0] ?? "";
          const bSequence = 笔顺映射.get(chb)?.[0] ?? "";
          return aSequence.length - bSequence.length;
        }
        return ak.element.localeCompare(bk.element);
      }}
    />
  );
}
