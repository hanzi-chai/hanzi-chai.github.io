import {
  Button,
  Dropdown,
  Empty,
  InputNumber,
  MenuProps,
  Select,
  Space,
  Typography,
} from "antd";
import { createContext, useContext } from "react";
import styled from "styled-components";
import { Draw, Glyph, N1, N2, N3, Stroke } from "../lib/data";
import { useComponents, useModify } from "./context";
import defaultClassifier from "../templates/strokes.yaml";
import { FlexContainer } from "./Utils";
import { getDummyStroke, halfToFull } from "../lib/utils";

const NameContext = createContext("");

const useNameAndGlyph = () => {
  const name = useContext(NameContext);
  const glyph = useComponents()[name];
  return [name, glyph] as [string, Glyph];
};

function deepcopy<T>(t: T) {
  return JSON.parse(JSON.stringify(t)) as T;
}

interface StrokeModelProps {
  stroke: Stroke;
  index: N1;
}

export const StrokeModel = ({
  stroke: { feature, start, curveList },
  index,
}: StrokeModelProps) => {
  const modify = useModify();
  const [name, glyph] = useNameAndGlyph();
  return (
    <Space direction="vertical">
      <FlexContainer>
        <Select
          value={feature}
          style={{ width: "128px" }}
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
            modify(name, modified);
          }}
        />
        <FlexContainer>
          {start.map((parameter, parameterIndex) => (
            <NumberModel
              parameter={parameter}
              index={index.concat(-1, parameterIndex) as N3}
              key={parameterIndex}
            />
          ))}
        </FlexContainer>
        <Button
          onClick={() => {
            const modified = deepcopy(glyph);
            modified.splice(index[0], 1);
            modify(name, modified);
          }}
        >
          删除
        </Button>
      </FlexContainer>
      <div>
        {curveList.map((draw, drawIndex) => (
          <DrawModel
            draw={draw}
            index={index.concat(drawIndex) as N2}
            key={drawIndex}
          />
        ))}
      </div>
    </Space>
  );
};

interface DrawModelProps {
  draw: Draw;
  index: [number, number];
}

const DrawModel = ({
  draw: { command, parameterList },
  index,
}: DrawModelProps) => (
  <FlexContainer>
    <span>{halfToFull(command.toUpperCase())}</span>
    <FlexContainer>
      {parameterList.map((parameter, parameterIndex) => (
        <NumberModel
          parameter={parameter}
          index={index.concat(parameterIndex) as N3}
          key={parameterIndex}
        />
      ))}
    </FlexContainer>
  </FlexContainer>
);

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
  const modify = useModify();
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
        modify(name, modified);
      }}
    />
  );
};

const StrokeAdder = () => {
  const modify = useModify();
  const [name, glyph] = useNameAndGlyph();
  const rawitems: MenuProps["items"] = Object.entries(defaultClassifier).map(
    ([x, v]) => ({
      key: x,
      label: x,
      onClick: () => {
        const modified = deepcopy(glyph);
        modified.push(getDummyStroke(x, Array.from(v.schema)));
        modify(name, modified);
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
  const components = useComponents();
  return (
    <>
      <Typography.Title level={2}>调整数据</Typography.Title>
      {name ? (
        <NameContext.Provider value={name}>
          {components[name].map((stroke, strokeIndex) => (
            <StrokeModel
              stroke={stroke}
              index={[strokeIndex]}
              key={strokeIndex}
            />
          ))}
          <FlexContainer>
            <StrokeAdder />
          </FlexContainer>
        </NameContext.Provider>
      ) : (
        <Empty />
      )}
    </>
  );
}
