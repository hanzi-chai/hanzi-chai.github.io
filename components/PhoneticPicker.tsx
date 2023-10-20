import { Flex, Input, Tabs, Typography } from "antd";
import { useState } from "react";
import { ComponentPool, CompoundPool, SlicePool } from "./Pool";
import StrokeSearch from "./StrokeSearch";
import ElementAdder from "./ElementAdder";
import { AName, analyzerNames, pinyinAnalyzers } from "../lib/element";
import { useCharacters, useDesign, usePhonetic } from "./context";
import Root from "./Root";
import Char from "./Char";
import styled from "styled-components";

const Content = styled(Flex)`
  padding: 8px;
  border: 1px solid black;
`;

const PhoneticPicker = () => {
  const [name, setName] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<AName>("声");
  const { mapping, alphabet } = usePhonetic();
  const design = useDesign();
  const characters = useCharacters();
  const syllables = [
    ...new Set(
      Object.values(characters)
        .map((x) => x.pinyin)
        .flat(),
    ),
  ];
  return (
    <>
      <Tabs
        activeKey={mode}
        centered
        items={analyzerNames.map((analyzer) => {
          const fn = pinyinAnalyzers[analyzer];
          const items = [...new Set(syllables.map(fn))].sort();
          return {
            label: analyzer,
            key: analyzer,
            children: (
              <Content gap="small" wrap="wrap">
                {items.map((i) => (
                  <Char
                    key={i}
                    type={i === name ? "primary" : "default"}
                    onClick={() => setName(i)}
                  >
                    {i}
                  </Char>
                ))}
              </Content>
            ),
          };
        })}
        onChange={(e) => {
          setMode(e as AName);
        }}
      />
      <ElementAdder name={name} />
    </>
  );
};

export default PhoneticPicker;
