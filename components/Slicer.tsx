import styled from "styled-components";
import Modal from "antd/es/modal/Modal";
import { useContext, useState } from "react";
import { WenContext } from "./Context";
import { Checkbox, Input } from "antd";
import { StrokesView } from "./ComponentView";

const ModalContent = styled.div`
  display: flex;
  align-items: center;
  gap: 32px;
`;

const StrokeList = styled.ul`
  padding-left: 0;
  display: flex;
  flex-direction: column;
  min-width: 100px;
`;

const Box = styled.div`
  border: 1px solid black;
  aspect-ratio: 1;
`;

interface SlicerProps {
  isModalOpen: boolean;
  handleOk: (s: { name: string; indices: number[] }) => void;
  handleCancel: () => void;
  componentName: string;
}

const Namer = styled.div`
  display: flex;
  align-items: center;
  margin: 16px 0;
`;

const Label = styled.span`
  min-width: 120px;
`;

const Slicer = ({
  isModalOpen,
  handleOk,
  handleCancel,
  componentName,
}: SlicerProps) => {
  const CHAI = useContext(WenContext);
  const component = CHAI[componentName];
  const { glyph } = component.shape[0];
  const [indices, setIndices] = useState(glyph.map((_, index) => index));
  const subglyph = glyph.filter((_, index) => indices.includes(index));
  const [name, setName] = useState("");
  return (
    <Modal
      title="切片器"
      open={isModalOpen}
      onOk={() => handleOk({ name, indices })}
      onCancel={handleCancel}
    >
      <Namer>
        <Label>字根名称</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Namer>
      <ModalContent>
        <StrokeList>
          {CHAI[componentName!].shape[0].glyph.map(({ feature }, index) => {
            return (
              <Checkbox
                key={index}
                checked={indices.includes(index)}
                onChange={(event) => {
                  if (event.target.checked) {
                    setIndices(indices.concat(index));
                  } else {
                    setIndices(indices.filter((x) => x !== index));
                  }
                }}
              >
                {feature}
              </Checkbox>
            );
          })}
        </StrokeList>
        <Box>
          <StrokesView glyph={subglyph} />
        </Box>
      </ModalContent>
    </Modal>
  );
};

export default Slicer;
