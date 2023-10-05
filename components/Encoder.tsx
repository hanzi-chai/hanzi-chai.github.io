import Dagre from "@dagrejs/dagre";
import React, { useContext, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  ReactFlowProvider,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  BackgroundVariant,
  Controls,
} from "reactflow";
import { Alert, Button, Col, Dropdown, Row, Typography } from "antd";
import styled from "styled-components";
import { CacheContext, ConfigContext, YinContext } from "./Context";

import "reactflow/dist/style.css";
import { Toolbar } from "./Analysis";
import encode from "../lib/encoder";
const Wrapper = styled(Row)``;

const getLayoutedElements = (nodes: any[], edges: any[], options: any) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: options.direction });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) => g.setNode(node.id, node));

  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const { x, y } = g.node(node.id);

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

const Encoder = () => {
  const { fitView } = useReactFlow();
  const { elements, encoder } = useContext(ConfigContext);
  const initialNodes: Node[] = encoder.nodes.map(({ index, key }, i) => {
    return {
      id: i.toString(),
      position: { x: 0, y: i * 100 },
      data: { label: key },
      height: 40,
      width: 150,
    };
  });
  initialNodes.push({
    id: (-1).toString(),
    position: { x: -100, y: 0 },
    data: { label: "+" },
  });
  const initialEdges: Edge[] = encoder.edges.map(({ from, to }, i) => {
    return {
      id: i.toString(),
      source: from.toString(),
      target: to.toString(),
      animated: true,
    };
  });
  const { nodes: layoutNodes, edges: layoutEdges } = getLayoutedElements(
    initialNodes,
    initialEdges,
    { direction: "TB" },
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const [result, setResult] = useState<Record<string, string>>({});
  const cache = useContext(CacheContext);
  const yin = useContext(YinContext);
  const characters = Object.keys(yin);

  const onLayout = () => {
    const layouted = getLayoutedElements(nodes, edges, { direction: "TB" });
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
    window.requestAnimationFrame(() => {
      fitView();
    });
  };
  const ready = elements.every((v, i) => cache[i] !== undefined);
  const notready = elements
    .filter((v, i) => cache[i] === undefined)
    .map((v, i) => i)
    .join(", ");

  return (
    <Wrapper gutter={32} style={{ flex: "1" }}>
      <Col
        className="gutter-row"
        span={12}
        style={{ flex: "1", display: "flex", flexDirection: "column" }}
      >
        <Typography.Title level={2}>图编辑器</Typography.Title>
        <div style={{ flex: "1" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
          >
            <Panel position="top-right">
              <Button onClick={onLayout}>整理布局</Button>
            </Panel>
            <Background variant={BackgroundVariant.Cross} />
            <Controls />
          </ReactFlow>
        </div>
      </Col>
      <Col className="gutter-row" span={12}>
        <Typography.Title level={2}>编码生成</Typography.Title>
        {!ready && (
          <Alert message={notready + "尚未完成分析"} type="warning" closable />
        )}
        <Toolbar>
          {/* <StrokeSearch sequence={sequence} setSequence={setSequence} /> */}
          <Button
            type="primary"
            onClick={() =>
              setResult(encode(encoder, elements, characters, cache))
            }
          >
            计算
          </Button>
          <Button onClick={() => {}}>清空</Button>
          <Button onClick={() => {}}>导出</Button>
        </Toolbar>
      </Col>
    </Wrapper>
  );
};

export default function () {
  return (
    <ReactFlowProvider>
      <Encoder />
    </ReactFlowProvider>
  );
}
