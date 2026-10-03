import { Flex, Select, Space } from "antd";
import {
  合并字符串,
  type 元素,
  type 强类型广义安排,
  type 强类型广义引用,
  是强类型归并,
} from "hanzi-chai";
import { useAtomValue } from "jotai";
import {
  useAtomValueUnwrapped,
  全部合法元素原子,
  字母表原子,
  编码类型原子,
} from "~/atoms";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";

export const KeysEditor = ({
  value,
  onChange,
  allowVariables,
  allowPlaceholder,
}: {
  value: string | 强类型广义引用[];
  onChange: (newValue: string | 强类型广义引用[]) => void;
  allowVariables?: boolean;
  allowPlaceholder?: boolean;
}) => {
  const mappingType = useAtomValue(编码类型原子);
  const keys = Array.from(value);
  while (keys.length < (mappingType ?? 1)) {
    keys.push("");
  }
  return (
    <Space>
      {keys.map((key, index) => {
        return (
          <KeySelect
            key={index}
            value={key}
            onChange={(event) => {
              const newKeys = keys.map((v, i) => {
                return i === index ? event : v;
              });
              onChange(合并字符串(newKeys.filter((v) => v !== "")));
            }}
            allowEmpty={index !== 0}
            allowPlaceholder={allowPlaceholder}
            allowVariables={allowVariables}
            allowAlphabets
            allowElements
          />
        );
      })}
    </Space>
  );
};

type ValueType = "禁用" | "键位" | "归并";

const ValueEditor = ({
  value,
  onChange,
  allowVariables,
  allowPlaceholder,
  isCurrent,
  allowDisabled = true,
  extraMergeTargets,
}: {
  value: 强类型广义安排;
  onChange: (newValue: 强类型广义安排) => void;
  allowVariables?: boolean;
  allowPlaceholder?: boolean;
  isCurrent?: boolean;
  /** 是否允许「禁用」（加根分析场景无意义，可关闭） */
  allowDisabled?: boolean;
  /** 归并目标的额外选项：如本批次临时加入、尚未持久化的根 */
  extraMergeTargets?: 元素[];
}) => {
  const alphabet = useAtomValue(字母表原子);
  const { 笔画列表: 笔画 } = useAtomValueUnwrapped(全部合法元素原子);
  const currentType =
    value === null ? "禁用" : 是强类型归并(value) ? "归并" : "键位";
  return (
    <Flex gap="small">
      <Select<ValueType>
        value={currentType}
        onChange={(newValue) => {
          if (newValue === "禁用") {
            onChange(null);
          } else if (newValue === "归并") {
            onChange({ element: 笔画[0]! });
          } else {
            onChange(alphabet[0]!);
          }
        }}
        options={[
          ...(allowDisabled ? [{ label: "禁用", value: "禁用" }] : []),
          { label: "键位", value: "键位" },
          { label: "归并", value: "归并" },
        ]}
        disabled={isCurrent}
      />
      {是强类型归并(value) ? (
        <ElementSelect
          includeOptional
          extraElements={extraMergeTargets}
          value={value.element}
          onChange={(newValue) => onChange({ element: newValue })}
        />
      ) : value !== null ? (
        <KeysEditor
          value={value}
          onChange={onChange}
          allowVariables={allowVariables}
          allowPlaceholder={allowPlaceholder}
        />
      ) : null}
    </Flex>
  );
};

export default ValueEditor;
