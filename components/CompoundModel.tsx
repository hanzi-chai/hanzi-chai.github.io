import { Empty, Select, Typography } from "antd";
import { Operand } from "../lib/data";
import styled from "styled-components";
import { PropsWithChildren, useContext } from "react";
import { ZiContext } from "./Context";
import Char from "./Char";
import { MyInputNumber } from "./ComponentModel";

const Wrapper = styled.div``;

const LineWrapper = styled.div`
  display: flex;
  gap: 32px;
  align-items: baseline;
`;

const Label = styled.label``;

const Line = ({ label, children }: PropsWithChildren<{ label: string }>) => {
  return (
    <LineWrapper>
      <Label>{label}</Label>
      {children}
    </LineWrapper>
  );
};

const ideos: Operand[] = [
  "⿰",
  "⿱",
  "⿲",
  "⿳",
  "⿴",
  "⿵",
  "⿶",
  "⿷",
  "⿸",
  "⿹",
  "⿺",
  "⿻",
  "〾",
];

const CompoundModel = ({ name }: { name?: string }) => {
  const zi = useContext(ZiContext);
  return (
    <Wrapper>
      <Typography.Title level={2}>调整数据</Typography.Title>
      {name ? (
        <>
          <Line label="结构">
            <Select
              value={zi[name].operator}
              style={{ width: 120 }}
              onChange={(e) => {}}
              options={ideos.map((x) => ({ value: x, label: x }))}
            />
          </Line>
          <Line label="构成">
            <Char name={zi[name].operandList[0]} />
            <Char name={zi[name].operandList[1]} />
          </Line>
          {zi[name].mix && (
            <Line label="混合">
              <MyInputNumber min={1} max={20} value={zi[name].mix} />
            </Line>
          )}
        </>
      ) : (
        <Empty />
      )}
    </Wrapper>
  );
};

export default CompoundModel;
