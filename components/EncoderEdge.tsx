import { Button, Flex, Input, Popover } from "antd";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  useReactFlow,
} from "reactflow";
import { PlusOutlined } from "@ant-design/icons";
import styled from "styled-components";
import { useContext } from "react";
import { ConfigContext } from "./context";
import { EdgeData, NodeData } from "./graph";
import { table } from "../lib/encoder";
import { Select } from "./Utils";

const ConditionTrigger = styled(Button)<{ $labelX: number; $labelY: number }>`
  font-size: 8px !important;
  height: 12px !important;
  min-width: 12px !important;
  display: grid;
  place-content: center;
  position: absolute;
  transform: ${(props) =>
    `translate(-50%, -50%) translate(${props.$labelX}px,${props.$labelY}px)`};
  pointer-events: all;
`;

const ConditionEditor = ({
  conditions,
  id,
}: {
  conditions: EdgeData;
  id: string;
}) => {
  const { setEdges, getEdges } = useReactFlow<NodeData, EdgeData>();
  const { elements } = useContext(ConfigContext);
  const allNodes = elements.map(({ nodes }) => nodes).flat();
  const update = (modify: (e: EdgeData) => EdgeData) =>
    setEdges(
      getEdges().map((edge) => {
        return edge.id === id ? { ...edge, data: modify(edge.data!) } : edge;
      }),
    );
  return (
    <>
      {conditions.map(({ key, operator, value }, index) => {
        return (
          <Flex key={index}>
            <Select
              value={key}
              options={allNodes.map((x) => ({ value: x, label: x }))}
              onChange={(event) =>
                update((data) =>
                  data.map((v, i) => {
                    return i === index ? { ...v, key: event } : v;
                  }),
                )
              }
            />
            <Select
              value={operator}
              options={Object.keys(table).map((x) => ({
                value: x,
                label: x,
              }))}
              onChange={(event) =>
                update((data) =>
                  data.map((v, i) => {
                    return i === index ? { ...v, operator: event } : v;
                  }),
                )
              }
            />
            {["是", "不是"].includes(operator) && (
              <Input style={{ width: "128px" }} value={value} />
            )}
            <Button
              onClick={() =>
                update((data) => data.filter((v, i) => i !== index))
              }
            >
              删除
            </Button>
          </Flex>
        );
      })}
      <Button
        type="primary"
        onClick={() =>
          update((data) =>
            data.concat({
              key: allNodes[0],
              operator: "有",
            }),
          )
        }
      >
        添加
      </Button>
    </>
  );
};

const EncoderEdge = ({
  id,
  markerEnd,
  data,
  ...props
}: EdgeProps<EdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath(props);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <Popover
          title="条件"
          content={<ConditionEditor id={id} conditions={data!} />}
        >
          <ConditionTrigger
            shape="circle"
            size="small"
            $labelX={labelX}
            $labelY={labelY}
            className="nodrag nopan"
          >
            <PlusOutlined />
          </ConditionTrigger>
        </Popover>
      </EdgeLabelRenderer>
    </>
  );
};

export default EncoderEdge;
