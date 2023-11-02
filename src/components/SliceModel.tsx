import { getSequence, makeSequenceFilter } from "../lib/form";
import { deepcopy } from "../lib/utils";
import { Index, ItemSelect, Select } from "./Utils";
import { useAdd } from "./context";
import { useForm, useSlice, useComponent } from "./contants";
import { Checkbox, Flex, Form } from "antd";

const SliceModel = ({ char }: Index) => {
  const form = useForm();
  const glyph = useSlice(char);
  const modify = useAdd();
  const modified = deepcopy(glyph);
  const { source, indices } = glyph.slice;
  const { component } = useComponent(source);
  return (
    <Flex vertical>
      <Form.Item label="源部件">
        <ItemSelect
          char={source}
          onChange={(event) => {
            modified.slice = {
              source: event,
              indices: indices.slice(0, form[event].component!.length),
            };
            modify(char, modified);
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
                modify(char, modified);
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
