import { makeSequenceFilter2 } from "../lib/form";
import { Select } from "./Utils";
import { useModify, useComponents, useSlices, useClassifier } from "./context";
import { Checkbox, Flex, Form } from "antd";

const SliceModel = ({ name }: { name: string }) => {
  const components = useComponents();
  const slices = useSlices();
  const modify = useModify();
  const { source, indices } = slices[name];
  const glyph = components[source];
  const classifier = useClassifier();
  return (
    <Flex vertical>
      <Form.Item label="源部件">
        <Select
          showSearch
          placeholder="输入笔画搜索"
          value={source}
          options={Object.keys(components).map((x) => ({ value: x, label: x }))}
          onChange={(event) => {
            modify(name, {
              source: event,
              indices: indices.slice(0, components[event].length),
            });
          }}
          filterOption={(input, option) =>
            makeSequenceFilter2(classifier, input)(components[option!.value])
          }
          filterSort={(a, b) => {
            return components[a.value].length - components[b.value].length;
          }}
        />
      </Form.Item>
      <Flex vertical>
        {glyph.map(({ feature }, index) => {
          return (
            <Checkbox
              key={index}
              checked={indices.includes(index)}
              onChange={(event) => {
                const newindices = event.target.checked
                  ? indices.concat(index).sort()
                  : indices.filter((x) => x !== index);
                modify(name, { source, indices: newindices });
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
