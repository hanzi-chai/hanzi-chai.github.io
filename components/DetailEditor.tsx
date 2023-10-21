import { Panel, useReactFlow } from "reactflow";
import { ConditionData, SourceData } from "./graph";
import styled from "styled-components";
import { Cascader, Flex, Form, Input, Typography } from "antd";
import {
  CodableObject,
  parseList,
  pinyinAnalyzers,
  renderList,
} from "../lib/element";
import { Select } from "./Utils";
import { Op, binaryOps, ops } from "../lib/encoder";
import TextArea from "antd/es/input/TextArea";

const Background = styled(Flex)`
  width: 240px;
  height: 240px;
  background-color: white;
  border-radius: 8px;
  padding: 16px;
`;

const Item = styled(Form.Item)`
  margin: 0;
`;

interface Option {
  value: string | number;
  label: string;
  children?: Option[];
}
const DetailEditor = ({ selected }: { selected: string }) => {
  const { setNodes, setEdges, getNodes, getEdges, getNode } = useReactFlow<
    SourceData | ConditionData
  >();
  const nodes = getNodes();
  const { data } = getNode(selected)!;
  const options: Option[] = [
    {
      value: "字音",
      label: "字音",
      children: Object.keys(pinyinAnalyzers).map((v) => ({
        value: v,
        label: v,
      })),
    },
    {
      value: "字根",
      label: "字根",
      children: [1, 2, 3, 4, -1, -2, -3].map((v) => ({
        value: v,
        label: v.toString(),
      })),
    },
    {
      value: "笔画",
      label: "笔画",
      children: [1, 2, 3, 4, -1, -2, -3].map((v) => ({
        value: v,
        label: v.toString(),
        children: [1, 2, 3, 4, -1, -2, -3].map((v) => ({
          value: v,
          label: v.toString(),
        })),
      })),
    },
    {
      value: "二笔",
      label: "二笔",
      children: [1, 2, 3, 4, -1, -2, -3].map((v) => ({
        value: v,
        label: v.toString(),
        children: [1, 2, -1, -2].map((v) => {
          return {
            value: v,
            label: `(${v * 2 - Math.sign(v)}, ${v * 2})`,
          };
        }),
      })),
    },
    {
      value: "汉字",
      label: "汉字",
    },
  ];
  const update = (data: SourceData | ConditionData) => {
    setNodes(
      nodes.map((node) => (node.id === selected ? { ...node, data } : node)),
    );
  };
  return (
    <Panel position="top-right">
      <Background vertical gap="small">
        <Typography.Title level={4} style={{ margin: 0 }}>
          编辑节点 {selected}
        </Typography.Title>
        <Item label="取码">
          <Cascader
            style={{ width: "128px" }}
            value={renderList(data.object)}
            options={options}
            onChange={(event) => {
              const object = parseList(event) as CodableObject;
              update({ ...data, object });
            }}
          />
        </Item>
        {!("operator" in data) && (
          <Item label="码数">
            <Select
              style={{ width: "128px" }}
              value={data.index}
              options={[-1, 0, 1, 2].map((v) => ({
                value: v,
                label: v === -1 ? "全取" : (v + 1).toString(),
              }))}
              onChange={(event) => {
                update({ ...data, index: event === -1 ? undefined : event });
              }}
            />
          </Item>
        )}
        {"operator" in data && (
          <>
            <Item label="判断">
              <Select
                style={{ width: "128px" }}
                value={data.operator}
                options={ops.map((v) => ({
                  label: v,
                  value: v,
                }))}
                onChange={(event) => {
                  update({
                    ...data,
                    operator: event,
                    value: (binaryOps as readonly Op[]).includes(event)
                      ? ""
                      : undefined,
                  });
                }}
              />
            </Item>
            {data.value !== undefined && (
              <Item label="取值">
                <TextArea
                  rows={3}
                  style={{ width: "128px" }}
                  value={data.value}
                  onChange={(event) =>
                    update({ ...data, value: event.target.value })
                  }
                />
              </Item>
            )}
          </>
        )}
      </Background>
    </Panel>
  );
};

export default DetailEditor;
