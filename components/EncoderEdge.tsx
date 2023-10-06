import { Button, Input, Popover, Select } from "antd";
import {
  BaseEdge,
  Edge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  useReactFlow,
} from "reactflow";
import { PlusOutlined } from "@ant-design/icons";
import styled from "styled-components";
import { useContext } from "react";
import { ConfigContext } from "./Context";
import { NodeData } from "./EncoderNode";
import { table } from "../lib/encoder";
import { Condition } from "../lib/config";

const ConditionTrigger = styled(Button)`
  height: 12px !important;
  min-width: 12px !important;
  display: grid;
  place-content: center;
`;

const ConditionLine = styled.div`
  display: flex;
  gap: 8px;
  margin: 8px 0;
`;

export type EdgeData = Condition[];
export type EEdge = Edge<EdgeData>;

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
          <ConditionLine key={index}>
            <Select
              style={{ width: "96px" }}
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
              style={{ width: "96px" }}
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
              <Input style={{ width: "96px" }} value={value} />
            )}
            <Button
              onClick={() =>
                update((data) => data.filter((v, i) => i !== index))
              }
            >
              删除
            </Button>
          </ConditionLine>
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
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps<EdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            width: "12px",
            height: "12px",
          }}
          className="nodrag nopan"
        >
          <Popover
            title="条件"
            content={<ConditionEditor id={id} conditions={data!} />}
          >
            <ConditionTrigger shape="circle" size="small">
              <PlusOutlined style={{ fontSize: "8px" }} />
            </ConditionTrigger>
          </Popover>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default EncoderEdge;
