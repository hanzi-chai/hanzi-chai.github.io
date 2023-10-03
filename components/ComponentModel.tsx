import { Empty, InputNumber, Typography } from "antd";
import { createContext, useContext } from "react";
import styled from "styled-components";
import { Draw as Curve, Glyph, Stroke } from "../lib/data";
import {
  ConfigContext,
  DispatchContext,
  WenContext,
  useWenCustomized,
} from "./Context";
import { halfToFull } from "./utils";

export const Change = createContext(
  (a: number, b: number, c: number, d: number) => {},
);
const StrokeIndex = createContext(-1);
const CurveIndex = createContext(-1);
const NameContext = createContext("");

interface StrokeModelProps {
  stroke: Stroke;
  strokeIndex: number;
}

const FeatureAndStart = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export const StrokeModel = ({
  stroke: { feature, start, curveList },
  strokeIndex,
}: StrokeModelProps) => (
  <StrokeIndex.Provider value={strokeIndex}>
    <FeatureAndStart>
      <Typography.Title level={3}>{feature}</Typography.Title>
      <ButtonGroup>
        {start.map((parameter, parameterIndex) => (
          <NumberModel
            key={parameterIndex}
            parameter={parameter}
            parameterIndex={parameterIndex}
          />
        ))}
      </ButtonGroup>
    </FeatureAndStart>
    <CurveList>
      {curveList.map((curve, curveIndex) => (
        <CurveModel key={curveIndex} curve={curve} curveIndex={curveIndex} />
      ))}
    </CurveList>
  </StrokeIndex.Provider>
);

const CurveList = styled.ul`
  padding-left: 0;
  margin: 0;
`;

interface CurveModelProps {
  curve: Curve;
  curveIndex: number;
}

const CurveModel = ({ curve, curveIndex }: CurveModelProps) => (
  <CurveIndex.Provider value={curveIndex}>
    <List>
      <Command>{halfToFull(curve.command.toUpperCase())}</Command>
      <ButtonGroup>
        {curve.parameterList.map((parameter, parameterIndex) => (
          <NumberModel
            key={parameterIndex}
            parameter={parameter}
            parameterIndex={parameterIndex}
          />
        ))}
      </ButtonGroup>
    </List>
  </CurveIndex.Provider>
);

const Command = styled.span`
  text-align: center;
  display: inline-block;
  width: 20px;
  margin: 0 5px;
`;

const List = styled.li`
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0;
`;

interface NumberModelProps {
  parameter: number;
  parameterIndex: number;
}

export const MyInputNumber = styled(InputNumber)`
  width: 48px;
  & .ant-input-number-input {
    padding: 4px 8px;
  }
`;

const NumberModel = ({ parameter, parameterIndex }: NumberModelProps) => {
  const name = useContext(NameContext);
  const dispatch = useContext(DispatchContext);
  const glyph = useWenCustomized()[name];
  const strokeIndex = useContext(StrokeIndex),
    curveIndex = useContext(CurveIndex);
  return (
    <MyInputNumber
      min={-100}
      max={100}
      value={parameter}
      onChange={(value) => {
        const modified = JSON.parse(JSON.stringify(glyph)) as Glyph;
        if (curveIndex === -1) {
          modified[strokeIndex].start[parameterIndex] = value as number;
        } else {
          modified[strokeIndex].curveList[curveIndex].parameterList[
            parameterIndex
          ] = value as number;
        }
        dispatch({
          type: "data",
          subtype: "component",
          key: name,
          value: modified,
        });
      }}
    />
  );
};

export default function ComponentModel({ name }: { name?: string }) {
  const wen = useWenCustomized();
  return (
    <Wrapper>
      <Typography.Title level={2}>调整数据</Typography.Title>
      {name ? (
        <NameContext.Provider value={name!}>
          {wen[name].map((stroke, strokeIndex) => (
            <StrokeModel
              key={strokeIndex}
              stroke={stroke}
              strokeIndex={strokeIndex}
            />
          ))}
        </NameContext.Provider>
      ) : (
        <Empty />
      )}
    </Wrapper>
  );
}

const Wrapper = styled.div``;
