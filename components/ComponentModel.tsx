import { InputNumber, Typography } from "antd";
import { createContext, useContext } from "react";
import styled from "styled-components";
import { Curve, Stroke, Component } from "../lib/data";
import { DataContext } from "./Context";

export const Change = createContext(
  (a: number, b: number, c: number, d: number) => {}
);
const StrokeIndex = createContext(-1);
const CurveIndex = createContext(-1);

interface StrokeModelProps {
  stroke: Stroke;
  strokeIndex: number;
}

export const StrokeModel = ({
  stroke: { feature, start, curveList },
  strokeIndex,
}: StrokeModelProps) => (
  <StrokeIndex.Provider value={strokeIndex}>
    <h3>{feature}</h3>
    {start.map((parameter, parameterIndex) => (
      <NumberModel
        key={parameterIndex}
        parameter={parameter}
        parameterIndex={parameterIndex}
      />
    ))}
    <CurveList>
      {curveList.map((curve, curveIndex) => (
        <CurveModel key={curveIndex} curve={curve} curveIndex={curveIndex} />
      ))}
    </CurveList>
  </StrokeIndex.Provider>
);

const CurveList = styled.ul`
  padding-left: 0;
`;

interface CurveModelProps {
  curve: Curve;
  curveIndex: number;
}

const CurveModel = ({ curve, curveIndex }: CurveModelProps) => (
  <CurveIndex.Provider value={curveIndex}>
    <List>
      <Command>{curve.command}</Command>
      {curve.parameterList.map((parameter, parameterIndex) => (
        <NumberModel
          key={parameterIndex}
          parameter={parameter}
          parameterIndex={parameterIndex}
        />
      ))}
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
`;

interface NumberModelProps {
  parameter: number;
  parameterIndex: number;
}

const NumberModel = ({ parameter, parameterIndex }: NumberModelProps) => {
  const change = useContext(Change),
    strokeIndex = useContext(StrokeIndex),
    curveIndex = useContext(CurveIndex);
  return (
    <InputNumber
      min={-100}
      max={100}
      value={parameter}
      onChange={(value) => {
        change(strokeIndex, curveIndex, parameterIndex, value!);
      }}
      style={{ width: "64px" }}
    />
  );
};

export default function ComponentModel({
  componentName,
}: {
  componentName?: string;
}) {
  const CHAI = useContext(DataContext);
  return (
    <Wrapper>
      <Typography.Title level={2}>调整数据</Typography.Title>

      {componentName &&
        CHAI[componentName].shape[0].glyph.map(
          (stroke, strokeIndex) => (
            <StrokeModel
              key={strokeIndex}
              stroke={stroke}
              strokeIndex={strokeIndex}
            />
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
        )}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  width: 42%;
  position: relative;
  padding: 0 0 0 2rem;
`;
