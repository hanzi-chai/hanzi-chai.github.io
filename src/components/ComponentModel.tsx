import {
  Button,
  Dropdown,
  Empty,
  Flex,
  MenuProps,
  Select,
  Space,
  Typography,
} from "antd";
import { createContext, useContext } from "react";
import { Draw, Glyph, N1, N2, N3, Stroke } from "../lib/data";
import { useComponent, useForm, useModify } from "./context";
import { deepcopy, getDummyStroke, halfToFull } from "../lib/utils";
import { Index, NumberInput } from "./Utils";
import classifier, { Feature, schema } from "../lib/classifier";

const NameContext = createContext("");

const useNameAndGlyph = () => {
  const name = useContext(NameContext);
  const glyph = useForm()[name];
  return [name, glyph] as const;
};

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
    <Flex vertical gap="small">
      <Flex justify="space-between">
        <Select<Feature>
          value={feature}
          options={Object.keys(classifier).map((x) => ({
            label: x,
            value: x,
          }))}
          onChange={(value) => {
            const modified = deepcopy(glyph);
            const newstroke = getDummyStroke(value, schema[value]);
            modified.component![index[0]] = { ...newstroke, start };
            modify(name, modified);
          }}
        />
        <Space>
          {start.map((parameter, parameterIndex) => (
            <NumberModel
              parameter={parameter}
              index={index.concat(-1, parameterIndex) as N3}
              key={parameterIndex}
            />
          ))}
        </Space>
        <Button
          onClick={() => {
            const modified = deepcopy(glyph);
            modified.component!.splice(index[0], 1);
            modify(name, modified);
          }}
        >
          删除
        </Button>
      </Flex>
      {curveList.map((draw, drawIndex) => (
        <DrawModel
          draw={draw}
          index={index.concat(drawIndex) as N2}
          key={drawIndex}
        />
      ))}
    </Flex>
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
  <Space>
    {halfToFull(command.toUpperCase())}
    {parameterList.map((parameter, parameterIndex) => (
      <NumberModel
        parameter={parameter}
        index={index.concat(parameterIndex) as N3}
        key={parameterIndex}
      />
    ))}
  </Space>
);

interface NumberModelProps {
  parameter: number;
  index: [number, number, number];
}

const NumberModel = ({ parameter, index }: NumberModelProps) => {
  const modify = useModify();
  const [name, glyph] = useNameAndGlyph();
  const [strokeIndex, drawIndex, parameterIndex] = index;
  return (
    <NumberInput
      min={-100}
      max={100}
      value={parameter}
      onChange={(value) => {
        const modified = deepcopy(glyph);
        if (drawIndex === -1) {
          modified.component![strokeIndex].start[parameterIndex] =
            value as number;
        } else {
          modified.component![strokeIndex].curveList[drawIndex].parameterList[
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
  const rawitems: MenuProps["items"] = Object.entries(schema).map(([x, v]) => ({
    key: x,
    label: x,
    onClick: () => {
      const modified = deepcopy(glyph);
      modified.component!.push(getDummyStroke(x as Feature, v));
      modify(name, modified);
    },
  }));
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

export default function ComponentModel({ char }: Index) {
  const { component } = useComponent(char);
  return (
    <NameContext.Provider value={char}>
      <Flex vertical gap="large">
        {component.map((stroke, strokeIndex) => (
          <StrokeModel
            stroke={stroke}
            index={[strokeIndex]}
            key={strokeIndex}
          />
        ))}
      </Flex>
      <Flex justify="center">
        <StrokeAdder />
      </Flex>
    </NameContext.Provider>
  );
}
