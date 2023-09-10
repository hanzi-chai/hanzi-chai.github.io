import { InputNumber } from "antd";
import { createContext, useContext } from "react";

export const Change = createContext(
  (a: number, b: number, c: number, d: number) => {},
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
    <ul>
      {curveList.map((curve, curveIndex) => (
        <CurveModel key={curveIndex} curve={curve} curveIndex={curveIndex} />
      ))}
    </ul>
  </StrokeIndex.Provider>
);

interface CurveModelProps {
  curve: Curve;
  curveIndex: number;
}

const CurveModel = ({ curve, curveIndex }: CurveModelProps) => (
  <CurveIndex.Provider value={curveIndex}>
    <li>
      <span className="command">{curve.command}</span>
      {curve.parameterList.map((parameter, parameterIndex) => (
        <NumberModel
          key={parameterIndex}
          parameter={parameter}
          parameterIndex={parameterIndex}
        />
      ))}
    </li>
  </CurveIndex.Provider>
);

interface NumberModelProps {
  parameter: number;
  parameterIndex: number;
}

const NumberModel = ({ parameter, parameterIndex }: NumberModelProps) => {
  const change = useContext(Change),
    strokeIndex = useContext(StrokeIndex),
    curveIndex = useContext(CurveIndex);
  return (
    <InputNumber min={-100} max={100} value={parameter} onChange={(value) => {
      change(strokeIndex, curveIndex, parameterIndex, value!)
    }} style={{width: "64px"}}/>
  );
};

export default function ComponentModel({
  component,
}: {
  component: Component;
}) {
  return (
    <div id="model">
      <h2>调整数据</h2>

      {component?.shape && (
        <Change.Provider
          value={async (
            strokeIndex: number,
            curveIndex: number,
            parameterIndex: number,
            value: number,
          ) => {
            const modified = JSON.parse(
              JSON.stringify(component.shape[0].glyph),
            );
            if (curveIndex === -1) {
              modified[strokeIndex].start[parameterIndex] = value;
            } else {
              modified[strokeIndex].curveList[curveIndex].parameterList[
                parameterIndex
              ] = value;
            }
            // const newData = {
            //   shape: [{ ...component.shape[0], glyph: modified }],
            // };
            // await fetch(`/data`, {
            //   headers: { 'Content-Type': 'application/json' },
            //   method: 'PUT',
            //   body: JSON.stringify({ key: currentComponent, value: newData })
            // });
            // await mutate(newData);
          }}
        >
          {component.shape[0].glyph.map((stroke, strokeIndex) => (
            <StrokeModel
              key={strokeIndex}
              stroke={stroke}
              strokeIndex={strokeIndex}
            />
          ))}
        </Change.Provider>
      )}
    </div>
  );
}
