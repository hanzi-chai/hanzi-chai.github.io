import { Button, Checkbox, Modal, Row, Tabs, Typography } from "antd";
import { useContext, useState } from "react";
import styled from "styled-components";
import { WenContext, DispatchContext } from "./Context";
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
  const [name, setName] = useState(undefined as string | undefined);
  const dispatch = useContext(DispatchContext);
  const [sequence, setSequence] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState("component" as "component" | "compound");

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleOk = ({ name, indices }: { name: string; indices: number[] }) => {
    dispatch({
      type: "root",
      subtype: "add-sliced",
      element: 0,
      name,
      key: "a",
      source: name!,
      indices,
    });
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
        activeKey={mode}
        centered
        items={[
          { label: "部件", key: "component" },
          { label: "复合体", key: "compound" },
        ]}
        onChange={(e) => setMode(e as "component" | "compound")}
      />
      <Pool
        elementIndex={0}
        type={mode}
        name={name}
        setName={setName}
        sequence={sequence}
      />
      <ButtonGroup>
        {mode === "component" && (
          <Button disabled={name === undefined} onClick={showModal}>
            切片
          </Button>
        )}
        {mode === "component" && name && (
          <Slicer
            isModalOpen={isModalOpen}
            handleOk={handleOk}
            handleCancel={handleCancel}
            componentName={name}
          />
        )}
        <Button
          type="primary"
          disabled={name === undefined}
          onClick={() =>
            name &&
            dispatch({
              type: "root",
              subtype: "add",
              element: 0,
              name,
              key: "a",
            })
          }
        >
          添加
        </Button>
      </ButtonGroup>
    </Wrapper>
  );
};

export default RootPicker;
