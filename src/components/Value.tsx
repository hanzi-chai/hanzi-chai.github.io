import { Flex, Select, Space } from "antd";
import { useAtomValue } from "jotai";
import { alphabetAtom, mappingTypeAtom } from "~/atoms";
import { GeneralizedValue, isMerge, joinKeys, GeneralizedKey } from "~/lib";
import KeySelect from "./KeySelect";
import ElementSelect from "./ElementSelect";

const KeysEditor = ({
  value,
  onChange,
}: {
  value: string | GeneralizedKey[];
  onChange: (newValue: string | GeneralizedKey[]) => void;
}) => {
  const mappingType = useAtomValue(mappingTypeAtom);
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
              const newValue = keys.map((v, i) => {
                return i === index ? event : v;
              });
              onChange(joinKeys(newValue));
            }}
            allowEmpty={index !== 0}
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
}: {
  value: GeneralizedValue;
  onChange: (newValue: GeneralizedValue) => void;
  excludeNull?: boolean;
}) => {
  const alphabet = useAtomValue(alphabetAtom);
  const currentType =
    value === null ? "禁用" : isMerge(value) ? "归并" : "键位";
  return (
    <Flex gap="small">
      <Select<ValueType>
        value={currentType}
        onChange={(newValue) => {
          if (newValue === "禁用") {
            onChange(null);
          } else if (newValue === "归并") {
            onChange({ element: "1" });
          } else {
            onChange(alphabet[0]!);
          }
        }}
        options={[
          { label: "禁用", value: "禁用" },
          { label: "键位", value: "键位" },
          { label: "归并", value: "归并" },
        ]}
      />
      {isMerge(value) ? (
        <ElementSelect
          includeOptional
          value={value.element}
          onChange={(newValue) => {
            onChange({ element: newValue });
          }}
        />
      ) : value !== null ? (
        <KeysEditor value={value} onChange={onChange} />
      ) : null}
    </Flex>
  );
};

export default ValueEditor;
