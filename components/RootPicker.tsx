import { Flex, Input, Tabs, Typography } from "antd";
import { useState } from "react";
import Pool from "./Pool";
import StrokeSearch from "./StrokeSearch";
import ElementAdder from "./ElementAdder";
import styled from "styled-components";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
`;

const formElementTypes = ["字根", "笔画", "二笔"] as const;
type FormElementTypes = (typeof formElementTypes)[number];

const RootPicker = () => {
  const [char, setChar] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<FormElementTypes>("字根");
  const [sequence, setSequence] = useState("");
  const getFET = (fet: FormElementTypes) => {
    switch (fet) {
      case "字根":
        return <Pool char={char} setChar={setChar} sequence={sequence} />;
      case "笔画":
        return <Content gap="small" wrap="wrap"></Content>;
      case "二笔":
        return <Content></Content>;
    }
  };
  return (
    <>
      <StrokeSearch sequence={sequence} setSequence={setSequence} />
      <Tabs
        activeKey={mode}
        centered
        items={formElementTypes.map((fet) => {
          return {
            label: fet,
            key: fet,
            children: getFET(fet),
          };
        })}
        onChange={(e) => {
          setMode(e as FormElementTypes);
        }}
      />

      <ElementAdder char={char} />
    </>
  );
};

export default RootPicker;
