import { Input, Tabs, Typography } from "antd";
import { useState } from "react";
import { ComponentPool, CompoundPool, SlicePool } from "./Pool";
import StrokeSearch from "./StrokeSearch";
import ElementAdder from "./ElementAdder";

const RootPicker = () => {
  const [name, setName] = useState(undefined as string | undefined);
  const [sequence, setSequence] = useState("");
  const [mode, setMode] = useState(
    "component" as "component" | "compound" | "slice",
  );
  return (
    <>
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
      <ElementAdder name={name} />
    </>
  );
};

export default RootPicker;
