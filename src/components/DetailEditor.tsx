import { Panel, useReactFlow } from "reactflow";
import type { ConditionData, SourceData } from "./graph";
import styled from "styled-components";
import { Cascader, Flex, Form, Typography } from "antd";
import type { CodableObject } from "~/lib/element";
import { parseList, defaultAlgebra, renderList } from "~/lib/element";
import { Select } from "./Utils";
import type { Op, UnaryOp } from "~/lib/config";
import { binaryOps, ops, unaryOps } from "~/lib/config";
import TextArea from "antd/es/input/TextArea";
import { useAtomValue, configFormAtom, algebraAtom } from "~/atoms";

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
  const { setNodes, getNodes, getNode } = useReactFlow<
    SourceData | ConditionData
  >();
  const nodes = getNodes();
  const { data } = getNode(selected)!;
  const { alphabet } = useAtomValue(configFormAtom);
  const algebra = useAtomValue(algebraAtom);
  const genericIndices = [...Array(10).keys()]
    .map((x) => [x + 1, -(x + 1)])
    .flat();
  const options: Option[] = [
    {
      value: "字音",
      label: "字音",
      children: [...Object.keys(defaultAlgebra), ...Object.keys(algebra)].map(
        (v) => ({
          value: v,
          label: v,
        }),
      ),
    },
    {
      value: "字根",
      label: "字根",
      children: genericIndices.map((v) => ({
        value: v,
        label: `第 ${v.toString()} 根`,
      })),
    },
    {
      value: "笔画",
      label: "笔画",
      children: genericIndices.map((v) => ({
        value: v,
        label: `第 ${v.toString()} 根`,
        children: genericIndices.map((v) => ({
          value: v,
          label: `第 ${v.toString()} 笔`,
        })),
      })),
    },
    {
      value: "二笔",
      label: "二笔",
      children: genericIndices.map((v) => ({
        value: v,
        label: `第 ${v.toString()} 根`,
        children: genericIndices.map((v) => {
          return {
            value: v,
            label: `第 (${v * 2 - Math.sign(v)}, ${v * 2}) 笔`,
          };
        }),
      })),
    },
    {
      value: "汉字",
      label: "汉字",
    },
    {
      value: "结构",
      label: "结构",
    },
    {
      value: "固定",
      label: "固定",
      children: [...alphabet].map((v) => ({
        value: v,
        label: v,
      })),
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
            value={renderList(data.object!)}
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
                event === -1
                  ? update({ ...data, index: undefined })
                  : update({ ...data, index: event });
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
                  if ((unaryOps as readonly Op[]).includes(event)) {
                    update({ ...data, operator: event });
                  } else {
                    update({
                      ...data,
                      operator: event,
                      value: "",
                    });
                  }
                }}
              />
            </Item>
            {"value" in data && (
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
