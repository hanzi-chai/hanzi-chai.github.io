import { Flex, Select, Space } from "antd";
import { useAtomValue } from "jotai";
import { 字母表原子, 编码类型原子 } from "~/atoms";
import {
  合并字符串,
  type 广义安排,
  type 广义码位,
  是归并,
  是聚类,
} from "~/lib";
import KeySelect from "./KeySelect";
import ElementSelect from "./ElementSelect";

const KeysEditor = ({
  value,
  onChange,
  allowVariables,
  allowPlaceholder,
}: {
  value: string | 广义码位[];
  onChange: (newValue: string | 广义码位[]) => void;
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

type ValueType = "禁用" | "键位" | "归并" | "聚类";

const ClusterEditor = ({
  value,
  onChange,
  allowVariables,
  allowPlaceholder,
}: {
  value: 广义码位[];
  onChange: (newValue: 广义安排) => void;
  allowVariables?: boolean;
  allowPlaceholder?: boolean;
}) => {
  const mappingType = useAtomValue(编码类型原子);
  const firstCode = value[0] as { element: string; index: number };
  // Remaining small codes (from index 1 onwards)
  const restKeys: 广义码位[] = value.slice(1);
  while (restKeys.length < (mappingType ?? 1) - 1) {
    restKeys.push("");
  }
  return (
    <Space>
      <ElementSelect
        includeOptional
        value={firstCode.element}
        onChange={(newElement) => {
          onChange([{ element: newElement, index: 0 }, ...restKeys]);
        }}
        style={{ minWidth: 96 }}
      />
      {restKeys.map((key, index) => (
        <KeySelect
          key={index}
          value={key}
          onChange={(event) => {
            const newRest = restKeys.map((v, i) => (i === index ? event : v));
            onChange(
              合并字符串([
                firstCode as 广义码位,
                ...newRest.filter((v) => v !== ""),
              ]),
            );
          }}
          allowEmpty
          allowPlaceholder={allowPlaceholder}
          allowVariables={allowVariables}
          allowAlphabets
          allowElements
        />
      ))}
    </Space>
  );
};

const ValueEditor = ({
  value,
  onChange,
  allowVariables,
  allowPlaceholder,
  isCurrent,
  excludeTypes,
}: {
  value: 广义安排;
  onChange: (newValue: 广义安排) => void;
  allowVariables?: boolean;
  allowPlaceholder?: boolean;
  isCurrent?: boolean;
  excludeTypes?: ValueType[];
}) => {
  const alphabet = useAtomValue(字母表原子);
  const currentType =
    value === null
      ? "禁用"
      : 是归并(value)
        ? "归并"
        : 是聚类(value)
          ? "聚类"
          : "键位";
  const allOptions: { label: string; value: ValueType }[] = [
    { label: "禁用", value: "禁用" },
    { label: "键位", value: "键位" },
    { label: "聚类", value: "聚类" },
    { label: "归并", value: "归并" },
  ];
  const filteredOptions = excludeTypes
    ? allOptions.filter((o) => !excludeTypes.includes(o.value))
    : allOptions;
  return (
    <Flex gap="small">
      <Select<ValueType>
        value={currentType}
        onChange={(newValue) => {
          if (newValue === "禁用") {
            onChange(null);
          } else if (newValue === "归并") {
            onChange({ element: "1" });
          } else if (newValue === "聚类") {
            onChange([{ element: "1", index: 0 }, alphabet[0]!]);
          } else {
            onChange(alphabet[0]!);
          }
        }}
        options={filteredOptions}
        disabled={isCurrent}
      />
      {是归并(value) ? (
        <ElementSelect
          includeOptional
          value={value.element}
          onChange={(newValue) => {
            onChange({ element: newValue });
          }}
        />
      ) : 是聚类(value) ? (
        <ClusterEditor
          value={value}
          onChange={onChange}
          allowVariables={allowVariables}
          allowPlaceholder={allowPlaceholder}
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
