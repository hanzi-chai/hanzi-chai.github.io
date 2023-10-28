import { Empty, Form, Typography } from "antd";
import { Compound, Glyph, Operator } from "../lib/data";
import { useClassifier, useCompound, useForm, useModify } from "./context";
import { Index, ItemSelect, NumberInput, Select } from "./Utils";
import { getSequence } from "../lib/form";
import { deepcopy } from "../lib/utils";

const ideos: Operator[] = [
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

const CompoundModel = ({ char }: Index) => {
  const form = useForm();
  const glyph = useCompound(char);
  const { operator, operandList, mix } = glyph.compound!;
  const modify = useModify();
  const modified = deepcopy(glyph);
  const classifier = useClassifier();
  return (
    <>
      <Form.Item label="结构">
        <Select
          value={operator}
          onChange={(operator) => {
            modified.compound.operator = operator;
            modify(char, modified);
          }}
          options={ideos.map((x) => ({ value: x, label: x }))}
        />
      </Form.Item>
      {operandList.map((value, index) => {
        return (
          <Form.Item label={`第 ${index + 1} 部`} key={index}>
            <ItemSelect
              char={value}
              onChange={(event) => {
                modified.compound.operandList[index] = event;
                modify(char, modified);
              }}
            />
          </Form.Item>
        );
      })}
      {mix && (
        <Form.Item label="混合">
          <NumberInput min={1} max={20} value={mix} />
        </Form.Item>
      )}
    </>
  );
};

export default CompoundModel;
