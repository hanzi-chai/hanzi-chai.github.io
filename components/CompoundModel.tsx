import { Empty, Form, Typography } from "antd";
import { Compound, Glyph, Operator } from "../lib/data";
import { useClassifier, useForm, useFormByChar, useModify } from "./context";
import { NumberInput, Select } from "./Utils";
import { getSequence } from "../lib/form";

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

const CompoundModel = ({ name }: { name: string }) => {
  const form = useForm();
  const glyph = useFormByChar(name);
  const { operator, operandList, mix } = glyph.compound!;
  const modify = useModify();
  const modified = JSON.parse(JSON.stringify(glyph)) as Glyph;
  const classifier = useClassifier();
  return (
    <>
      <Form.Item label="结构">
        <Select
          value={operator}
          onChange={(operator) => {
            modified.compound!.operator = operator;
            modify(name, modified);
          }}
          options={ideos.map((x) => ({ value: x, label: x }))}
        />
      </Form.Item>
      {operandList.map((value, index) => {
        return (
          <Form.Item label={`第 ${index + 1} 部`} key={index}>
            <Select
              showSearch
              value={String.fromCodePoint(value)}
              placeholder="Select a person"
              optionFilterProp="children"
              onChange={(part) => {
                modified.compound!.operandList[index] = part.codePointAt(0)!;
                modify(name, modified);
              }}
              filterOption={(input, option) =>
                getSequence(form, classifier, option!.value).startsWith(input)
              }
              options={Object.entries(form).map(([x, v]) => ({
                value: x,
                label: v.name || x,
              }))}
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
