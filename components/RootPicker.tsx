import {
  Button,
  Checkbox,
  Input,
  Modal,
  Row,
  Select,
  Tabs,
  Typography,
} from "antd";
import { useContext, useState } from "react";
import styled from "styled-components";
import { useIndex, useRoot, useDesign } from "./Context";
import Pool, { ComponentPool, CompoundPool, SlicePool } from "./Pool";
import StrokeSearch from "./StrokeSearch";
import Slicer from "./Slicer";
import ElementAdder from "./ElementAdder";
import { ButtonContainer } from "./Utils";

const Wrapper = styled.div``;

const RootPicker = () => {
  const [name, setName] = useState(undefined as string | undefined);
  const design = useDesign();
  const [sequence, setSequence] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(
    "component" as "component" | "compound" | "slice",
  );
  const handleOk = ({
    sliceName,
    indices,
  }: {
    sliceName: string;
    indices: number[];
  }) => {
    design({
      subtype: "root-aliaser",
      action: "add",
      key: sliceName,
      value: {
        source: name!,
        indices,
      },
    });
    setOpen(false);
    setName(sliceName);
    setMode("slice");
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <Wrapper>
      <Typography.Title level={2}>来源</Typography.Title>
      {mode === "compound" ? (
        <Input
          value={sequence}
          placeholder="输入复合体名称"
          onChange={(event) => setSequence(event.target.value)}
        />
      ) : (
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
      )}
      <Tabs
        activeKey={mode}
        centered
        items={[
          {
            label: "部件",
            key: "component",
            children: (
              <ComponentPool
                name={name}
                setName={setName}
                sequence={sequence}
              />
            ),
          },
          {
            label: "切片",
            key: "slice",
            children: (
              <SlicePool name={name} setName={setName} sequence={sequence} />
            ),
          },
          {
            label: "复合体",
            key: "compound",
            children: (
              <CompoundPool name={name} setName={setName} sequence={sequence} />
            ),
          },
        ]}
        onChange={(e) => {
          setMode(e as "component" | "compound");
          setSequence("");
          setName(undefined);
        }}
      />
      {mode === "component" && name && (
        <Slicer
          isModalOpen={open}
          handleOk={handleOk}
          handleCancel={handleCancel}
          componentName={name}
        />
      )}
      <ButtonContainer>
        {mode === "component" && (
          <Button onClick={() => setOpen(true)}>切片</Button>
        )}
        {mode === "slice" && (
          <Button
            onClick={() =>
              design({
                subtype: "root-aliaser",
                action: "remove",
                key: name!,
              })
            }
          >
            删除切片
          </Button>
        )}
      </ButtonContainer>
      <ElementAdder name={name} />
    </Wrapper>
  );
};

export default RootPicker;
