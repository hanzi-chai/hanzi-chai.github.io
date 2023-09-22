import { Empty, InputNumber, Typography } from "antd";
import { createContext, useContext } from "react";
import styled from "styled-components";
import { Draw as Curve, Stroke, Component } from "../lib/data";
import { WenContext } from "./Context";
import { halfToFull } from "../lib/utils";

export const Change = createContext(
  (a: number, b: number, c: number, d: number) => {},
);
const StrokeIndex = createContext(-1);
const CurveIndex = createContext(-1);

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
  const change = useContext(Change),
    strokeIndex = useContext(StrokeIndex),
    curveIndex = useContext(CurveIndex);
  return (
    <MyInputNumber
      min={-100}
      max={100}
      value={parameter}
      onChange={(value) => {
        change(strokeIndex, curveIndex, parameterIndex, 0);
      }}
    />
  );
};

export default function ComponentModel({
  componentName,
}: {
  componentName?: string;
}) {
  const CHAI = useContext(WenContext);
  return (
    <Wrapper>
      <Typography.Title level={2}>调整数据</Typography.Title>
      {
        componentName ? (
          CHAI[componentName].shape[0].glyph.map((stroke, strokeIndex) => (
            <StrokeModel
              key={strokeIndex}
              stroke={stroke}
              strokeIndex={strokeIndex}
            />
          ))
        ) : (
          <Empty />
        )
        // <Change.Provider
        // value={async (
        //   strokeIndex: number,
        //   curveIndex: number,
        //   parameterIndex: number,
        //   value: number
        // ) => {
        //   const modified = JSON.parse(
        //     JSON.stringify(component.shape[0].glyph)
        //   );
        //   if (curveIndex === -1) {
        //     modified[strokeIndex].start[parameterIndex] = value;
        //   } else {
        //     modified[strokeIndex].curveList[curveIndex].parameterList[
        //       parameterIndex
        //     ] = value;
        //   }
        // const newData = {
        //   shape: [{ ...component.shape[0], glyph: modified }],
        // };
        // await fetch(`/data`, {
        //   headers: { 'Content-Type': 'application/json' },
        //   method: 'PUT',
        //   body: JSON.stringify({ key: currentComponent, value: newData })
        // });
        // await mutate(newData);
        // }}
        // >
        // </Change.Provider>
      }
    </Wrapper>
  );
}

const Wrapper = styled.div``;
