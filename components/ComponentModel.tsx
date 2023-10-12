import {
  Button,
  Dropdown,
  Empty,
  InputNumber,
  MenuProps,
  Select,
  Typography,
} from "antd";
import { createContext, useContext } from "react";
import styled from "styled-components";
import { Draw, Glyph, N1, N2, N3, Stroke } from "../lib/data";
import { DispatchContext, useWenCustomized } from "./Context";
import defaultClassifier from "../templates/strokes.yaml";
import { ButtonContainer } from "./Utils";
import { getDummyStroke, halfToFull } from "../lib/utils";

const NameContext = createContext("");

const useNameAndGlyph = () => {
  const name = useContext(NameContext);
  const glyph = useWenCustomized()[name];
  return [name, glyph] as [string, Glyph];
};

const useDispatchComponent = () => {
  const dispatch = useContext(DispatchContext);
  return (name: string, glyph: Glyph) =>
    dispatch({ type: "data", subtype: "component", key: name, value: glyph });
};

function deepcopy<T>(t: T) {
  return JSON.parse(JSON.stringify(t)) as T;
}

interface StrokeModelProps {
  stroke: Stroke;
  index: N1;
}

const FeatureAndStart = styled.div`
  display: flex;
  justify-content: space-between;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: right;
  flex-wrap: wrap;
  gap: 8px;
`;

const StrokeModelWrapper = styled.div`
  margin: 32px 0;
`;

export const StrokeModel = ({
  stroke: { feature, start, curveList },
  index,
}: StrokeModelProps) => {
  const dispatch = useDispatchComponent();
  const [name, glyph] = useNameAndGlyph();
  return (
    <StrokeModelWrapper>
      <FeatureAndStart>
        <Select
          value={feature}
          style={{ width: 128 }}
          options={Object.keys(defaultClassifier).map((x) => ({
            label: x,
            value: x,
          }))}
          onChange={(value) => {
            const modified = deepcopy(glyph);
            const newstroke = getDummyStroke(
              value,
              Array.from(defaultClassifier[value].schema),
            );
            modified[index[0]] = { ...newstroke, start };
            dispatch(name, modified);
          }}
        />
        <ButtonGroup>
          {start.map((parameter, parameterIndex) => (
            <NumberModel
              parameter={parameter}
              index={index.concat(-1, parameterIndex) as N3}
              key={parameterIndex}
            />
          ))}
        </ButtonGroup>
        <Button
          onClick={() => {
            const modified = deepcopy(glyph);
            modified.splice(index[0], 1);
            dispatch(name, modified);
          }}
        >
          删除
        </Button>
      </FeatureAndStart>
      <DrawList>
        {curveList.map((draw, drawIndex) => (
          <DrawModel
            draw={draw}
            index={index.concat(drawIndex) as N2}
            key={drawIndex}
          />
        ))}
      </DrawList>
    </StrokeModelWrapper>
  );
};

const DrawList = styled.ul`
  padding-left: 0;
  margin: 0;
`;

interface DrawModelProps {
  draw: Draw;
  index: [number, number];
}

const DrawModel = ({
  draw: { command, parameterList },
  index,
}: DrawModelProps) => (
  <DrawModelWrapper>
    <span>{halfToFull(command.toUpperCase())}</span>
    <ButtonGroup>
      {parameterList.map((parameter, parameterIndex) => (
        <NumberModel
          parameter={parameter}
          index={index.concat(parameterIndex) as N3}
          key={parameterIndex}
        />
      ))}
    </ButtonGroup>
  </DrawModelWrapper>
);

const DrawModelWrapper = styled.li`
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0;
`;

interface NumberModelProps {
  parameter: number;
  index: [number, number, number];
}

export const MyInputNumber = styled(InputNumber)`
  width: 48px;
  & .ant-input-number-input {
    padding: 4px 8px;
  }
`;

const NumberModel = ({ parameter, index }: NumberModelProps) => {
  const dispatch = useDispatchComponent();
  const [name, glyph] = useNameAndGlyph();
  const [strokeIndex, drawIndex, parameterIndex] = index;
  return (
    <MyInputNumber
      min={-100}
      max={100}
      value={parameter}
      onChange={(value) => {
        const modified = deepcopy(glyph);
        if (drawIndex === -1) {
          modified[strokeIndex].start[parameterIndex] = value as number;
        } else {
          modified[strokeIndex].curveList[drawIndex].parameterList[
            parameterIndex
          ] = value as number;
        }
        dispatch(name, modified);
      }}
    />
  );
};

const StrokeAdder = () => {
  const dispatch = useDispatchComponent();
  const [name, glyph] = useNameAndGlyph();
  const rawitems: MenuProps["items"] = Object.entries(defaultClassifier).map(
    ([x, v]) => ({
      key: x,
      label: x,
      onClick: () => {
        const modified = deepcopy(glyph);
        modified.push(getDummyStroke(x, Array.from(v.schema)));
        dispatch(name, modified);
      },
    }),
  );
  const items: MenuProps["items"] = [
    { key: 0, label: "基本", children: rawitems.slice(0, 7) },
    { key: 1, label: "折类 I", children: rawitems.slice(7, 13) },
    { key: 2, label: "折类 II", children: rawitems.slice(13, 20) },
    { key: 3, label: "折类 III", children: rawitems.slice(20, 27) },
    { key: 4, label: "折类 IV", children: rawitems.slice(27) },
  ];
  return (
    <Dropdown menu={{ items }} placement="top">
      <Button type="primary">添加</Button>
    </Dropdown>
  );
};

export default function ComponentModel({ name }: { name?: string }) {
  const wen = useWenCustomized();
  return (
    <Wrapper>
      <Typography.Title level={2}>调整数据</Typography.Title>
      {name ? (
        <NameContext.Provider value={name}>
          {wen[name].map((stroke, strokeIndex) => (
            <StrokeModel
              stroke={stroke}
              index={[strokeIndex]}
              key={strokeIndex}
            />
          ))}
          <ButtonContainer>
            <StrokeAdder />
          </ButtonContainer>
        </NameContext.Provider>
      ) : (
        <Empty />
      )}
    </Wrapper>
  );
}

const Wrapper = styled.div``;
