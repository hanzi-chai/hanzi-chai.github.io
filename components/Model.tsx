import React, { Fragment } from 'react';
import { useComponent } from './View';

const Model = ({ char }: { char: string }) => {
  const framework = <div id="model"><h2>调整数据</h2></div>;
  const { data, error, mutate } = useComponent(char);
  if (data?.shape === undefined) return framework;
  const { shape } = data;
  const { glyph } = shape[0];
  const change = async (strokeIndex: number, curveIndex: number, parameterIndex: number, value: number) => {
    const modified = JSON.parse(JSON.stringify(glyph));
    if (curveIndex === -1) {
      modified[strokeIndex].start[parameterIndex] = value;
    } else {
      modified[strokeIndex].curveList[curveIndex].parameterList[parameterIndex] = value;
    }
    await fetch(`/data`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
      body: JSON.stringify({ char, strokes: modified })
    }).then(res => console.log(res.json()));
    await mutate({ shape: [{ ...shape[0], glyph: modified }] });
  };
  return (
    <div id="model">
      <h2>调整数据</h2>
      {
        glyph.map((stroke, strokeIndex) => <StrokeModel key={strokeIndex} stroke={stroke} strokeIndex={strokeIndex} change={change} />)
      }
    </div>
  );
}

interface StrokeModelProps {
  stroke: Stroke,
  strokeIndex: number,
  change: (si: number, ci: number, pi: number, v: number) => void
}

const StrokeModel = ({ stroke, strokeIndex, change }: StrokeModelProps) => {
  const { feature, start, curveList } = stroke;
  return (
    <Fragment>
      <h3>{feature}</h3>
      {
        start.map((parameter, parameterIndex) => <NumberModel key={parameterIndex} parameter={parameter} parameterIndex={parameterIndex} curveIndex={-1} strokeIndex={strokeIndex} change={change} />)
      }
      <ul>
        {
          curveList.map((curve, curveIndex) => <CurveModel key={curveIndex} curve={curve} curveIndex={curveIndex} strokeIndex={strokeIndex} change={change} />)
        }
      </ul>
    </Fragment>
  )
}

interface CurveModelProps {
  curve: Curve,
  curveIndex: number,
  strokeIndex: number,
  change: (si: number, ci: number, pi: number, v: number) => void
}

const CurveModel = ({ curve, curveIndex, strokeIndex, change }: CurveModelProps) => {
  const { command, parameterList } = curve;
  return (
    <li>
      <span className="command">{command}</span>
      {
        parameterList.map(
          (parameter, parameterIndex) => <NumberModel key={parameterIndex} parameter={parameter} parameterIndex={parameterIndex} curveIndex={curveIndex} strokeIndex={strokeIndex} change={change} />
        )
      }
    </li>
  )
}

interface NumberModelProps {
  parameter: number,
  parameterIndex: number,
  curveIndex: number,
  strokeIndex: number,
  change: (si: number, ci: number, pi: number, v: number) => void
}

const NumberModel = ({ parameter, parameterIndex, curveIndex, strokeIndex, change }: NumberModelProps) => {
  return (
    <span className="numberModel">
      <input
        className="number"
        value={parameter}
        onChange={event => change(strokeIndex, curveIndex, parameterIndex, parseInt(event.target.value))}>
      </input>
      <button className="increase" onClick={() => change(strokeIndex, curveIndex, parameterIndex, parameter + 1)}>↑</button>
      <button className="decrease" onClick={() => change(strokeIndex, curveIndex, parameterIndex, parameter - 1)}>↓</button>
    </span>
  )
}

export default Model;
