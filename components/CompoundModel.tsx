import { Empty, Form, Typography } from "antd";
import { Compound, Operand } from "../lib/data";
import { useComponents, useCompounds, useModify } from "./context";
import { NumberInput, Select } from "./Utils";

const ideos: Operand[] = [
  "⿰",
  "⿱",
  "⿲",
  "⿳",
  "⿴",
  "⿵",
  "⿶",
  "⿷",
  "⿸",
  "⿹",
  "⿺",
  "⿻",
  "〾",
];
// Filter `option.label` match the user type `input`
const filterOption = (
  input: string,
  option?: { label: string; value: string },
) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase());

const CompoundModel = ({ name }: { name: string }) => {
  const compounds = useCompounds();
  const components = useComponents();
  const modify = useModify();
  return (
    <>
      <Form.Item label="结构">
        <Select
          value={compounds[name].operator}
          onChange={(operator) => {
            const modified = JSON.parse(
              JSON.stringify(compounds[name]),
            ) as Compound;
            modified.operator = operator;
            modify(name, modified);
          }}
          options={ideos.map((x) => ({ value: x, label: x }))}
        />
      </Form.Item>
      {compounds[name].operandList.map((value, index) => {
        return (
          <Form.Item label={`第 ${index + 1} 部`} key={index}>
            <Select
              showSearch
              value={value}
              placeholder="Select a person"
              optionFilterProp="children"
              onChange={(part) => {
                const modified = JSON.parse(
                  JSON.stringify(compounds[name]),
                ) as Compound;
                modified.operandList[index] = part;
                modify(name, modified);
              }}
              filterOption={filterOption}
              options={Object.keys(compounds)
                .concat(Object.keys(components))
                .map((x) => ({ value: x, label: x }))}
            />
          </Form.Item>
        );
      })}
      {compounds[name].mix && (
        <Form.Item label="混合">
          <NumberInput min={1} max={20} value={compounds[name].mix} />
        </Form.Item>
      )}
    </>
  );
};

export default CompoundModel;
