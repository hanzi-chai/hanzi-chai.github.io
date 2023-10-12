import styled from "styled-components";
import { useModify, useComponents, useSlices } from "./context";
import { Checkbox } from "antd";

const StrokeList = styled.div`
  display: flex;
  flex-direction: column;
`;

const SliceModel = ({ name }: { name: string }) => {
  const components = useComponents();
  const slices = useSlices();
  const modify = useModify();
  const { source, indices } = slices[name];
  const glyph = components[source];
  return (
    <StrokeList>
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
    </StrokeList>
  );
};

export default SliceModel;
