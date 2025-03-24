import { Panel } from "reactflow";
import styled from "styled-components";
import { Cascader, Flex, Form, Typography } from "antd";
import type { CodableObject, Condition, Source, UnaryOp } from "~/lib";
import { parseList, defaultAlgebra, renderList } from "~/lib";
import { Select } from "./Utils";
import { ops, unaryOps } from "~/lib";
import TextArea from "antd/es/input/TextArea";
import { useAtomValue, keyboardAtom, algebraAtom } from "~/atoms";
import { customElementsAtom } from "~/atoms";

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

export default function DetailEditor({
  selected,
  data,
  setData,
}: {
  selected: string;
  data: Source | Condition | undefined;
  setData: (data: Source | Condition) => void;
}) {
  const { alphabet } = useAtomValue(keyboardAtom);
  const algebra = useAtomValue(algebraAtom);
  const customElements = useAtomValue(customElementsAtom);
  if (data === undefined) return null;
  const genericIndices = [...Array(10).keys()].flatMap((x) => [
    x + 1,
    -(x + 1),
  ]);
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
    {
      value: "自定义",
      label: "自定义",
      children: Object.keys(customElements).map((v) => ({
        value: v,
        label: v,
        children: genericIndices.map((v) => {
          return {
            value: v,
            label: `第 ${v.toString()} 元`,
          };
        }),
      })),
    },
    {
      value: "特殊",
      label: "特殊",
      children: [
        { value: "张码补码", label: "张码补码" },
        { value: "张码准码元", label: "张码准码元" },
      ],
    },
  ];
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
              setData({ ...data, object });
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
                  ? setData({ ...data, index: undefined })
                  : setData({ ...data, index: event });
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
                  if (unaryOps.includes(event as UnaryOp)) {
                    setData({ ...data, operator: event as UnaryOp });
                  } else {
                    setData({
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
                    setData({ ...data, value: event.target.value })
                  }
                />
              </Item>
            )}
          </>
        )}
      </Background>
    </Panel>
  );
}
