import { Empty, Form, Select, Typography } from "antd";
import { Compound, Operand } from "../lib/data";
import styled from "styled-components";
import { useComponents, useCompounds, useModify } from "./context";
import { MyInputNumber } from "./ComponentModel";

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

const CompoundModel = ({ name }: { name?: string }) => {
  const compounds = useCompounds();
  const components = useComponents();
  const modify = useModify();
  return (
    <>
      <Typography.Title level={2}>调整数据</Typography.Title>
      {name ? (
        <>
          <Form.Item label="结构">
            <Select
              value={compounds[name].operator}
              style={{ width: "128px" }}
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
                  style={{ width: "128px" }}
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
              <MyInputNumber min={1} max={20} value={compounds[name].mix} />
            </Form.Item>
          )}
        </>
      ) : (
        <Empty />
      )}
    </>
  );
};

export default CompoundModel;
