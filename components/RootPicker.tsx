import { Button, Checkbox, Modal, Row, Tabs, Typography } from "antd";
import { useContext, useState } from "react";
import styled from "styled-components";
import { DataContext, DispatchContext } from "./Context";
import Pool from "./Pool";
import StrokeSearch from "./StrokeSearch";
import Slicer from "./Slicer";

const Wrapper = styled.div``;

const ButtonGroup = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
`;

const RootPicker = () => {
  const [componentName, setComponentName] = useState(
    undefined as string | undefined
  );
  const dispatch = useContext(DispatchContext);
  const [sequence, setSequence] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleOk = ({ name, indices }: { name: string, indices: number[]}) => {
    dispatch({ type: "add-sliced-root", name, source: componentName!, indices })
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  return (
    <Wrapper>
      <Typography.Title level={2}>来源</Typography.Title>
      <StrokeSearch sequence={sequence} setSequence={setSequence} />
      <Tabs
        defaultActiveKey="1"
        centered
        items={[
          { label: "部件", key: "1" },
          { label: "复合体", key: "2" },
        ]}
      />
      <Pool
        componentName={componentName}
        setComponentName={setComponentName}
        sequence={sequence}
      />
      <ButtonGroup>
        <Button disabled={componentName === undefined} onClick={showModal}>
          切片
        </Button>
        { componentName && <Slicer
          isModalOpen={isModalOpen}
          handleOk={handleOk}
          handleCancel={handleCancel}
          componentName={componentName}
        /> }
        <Button
          type="primary"
          onClick={() =>
            componentName &&
            dispatch({ type: "add-root", content: componentName })
          }
        >
          添加
        </Button>
      </ButtonGroup>
    </Wrapper>
  );
};

export default RootPicker;
