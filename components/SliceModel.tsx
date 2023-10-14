import { useModify, useComponents, useSlices } from "./context";
import { Checkbox, Flex } from "antd";

const SliceModel = ({ name }: { name: string }) => {
  const components = useComponents();
  const slices = useSlices();
  const modify = useModify();
  const { source, indices } = slices[name];
  const glyph = components[source];
  return (
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
  );
};

export default SliceModel;
