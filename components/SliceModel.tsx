import { getSequence, makeSequenceFilter } from "../lib/form";
import { deepcopy } from "../lib/utils";
import { Select } from "./Utils";
import { useModify, useForm, useClassifier, useFormByChar } from "./context";
import { Checkbox, Flex, Form } from "antd";

const SliceModel = ({ name }: { name: string }) => {
  const form = useForm();
  const glyph = useFormByChar(name);
  const modify = useModify();
  const modified = deepcopy(glyph);
  const { source, indices } = glyph.slice!;
  const component = form[String.fromCodePoint(source)].component!;
  const classifier = useClassifier();
  return (
    <Flex vertical>
      <Form.Item label="源部件">
        <Select
          showSearch
          placeholder="输入笔画搜索"
          value={String.fromCodePoint(source)}
          options={Object.entries(form)
            .filter(([, v]) => v.default_type === 0)
            .map(([x, v]) => ({ value: x, label: v.name || x }))}
          onChange={(event) => {
            modified.slice = {
              source: event.codePointAt(0)!,
              indices: indices.slice(0, form[event].component!.length),
            };
            modify(name, modified);
          }}
          filterOption={(input, option) =>
            getSequence(form, classifier, option!.value).startsWith(input)
          }
          filterSort={(a, b) => {
            return (
              getSequence(form, classifier, a.value).length -
              getSequence(form, classifier, b.value).length
            );
          }}
        />
      </Form.Item>
      <Flex vertical>
        {component.map(({ feature }, index) => {
          return (
            <Checkbox
              key={index}
              checked={indices.includes(index)}
              onChange={(event) => {
                const newindices = event.target.checked
                  ? indices.concat(index).sort()
                  : indices.filter((x) => x !== index);
                modified.slice = { source, indices: newindices };
                modify(name, modified);
              }}
            >
              {feature}
            </Checkbox>
          );
        })}
      </Flex>
    </Flex>
  );
};

export default SliceModel;
