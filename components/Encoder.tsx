import Dagre from "@dagrejs/dagre";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Alert, Button, Col, Dropdown, MenuProps, Row, Typography } from "antd";
import styled from "styled-components";
import {
  CacheContext,
  ConfigContext,
  WenContext,
  YinContext,
  ZiContext,
} from "./Context";

import "reactflow/dist/style.css";
import { Toolbar, getPhonetic, getRoot } from "./Analysis";
import encode from "../lib/encoder";
import Table, { ColumnsType } from "antd/es/table";
import EncoderNode, { NodeData } from "./EncoderNode";
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

const isGB = (char: string) => {
  return char.charCodeAt(0) >= 0x4e00;
};

const Encoder = () => {
  const { fitView } = useReactFlow();
  const { elements, encoder } = useContext(ConfigContext);
  const initialNodes: Node<NodeData>[] = encoder.map(({ key }, i) => {
    return {
      id: i.toString(),
      position: { x: 0, y: i * 100 },
      data: { label: key },
      width: 96,
      height: 16,
      type: "encoder",
    };
  });
  const initialEdges: Edge[] = encoder
    .map(({ children }, from) => {
      return children.map(({ to }) => {
        return {
          id: `${from}-${to}`,
          source: from.toString(),
          target: to.toString(),
          animated: true,
        };
      });
    })
    .flat();
  const { nodes: layoutNodes, edges: layoutEdges } = getLayoutedElements(
    initialNodes,
    initialEdges,
    { direction: "TB" },
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const [result, setResult] = useState<Record<string, string>>({});
  const wen = useContext(WenContext);
  const zi = useContext(ZiContext);
  const yin = useContext(YinContext);
  const characters = Object.keys(yin).filter(isGB);
  const nodeTypes = useMemo(() => ({ encoder: EncoderNode }), []);

  const onLayout = () => {
    const layouted = getLayoutedElements(nodes, edges, { direction: "TB" });
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
    window.requestAnimationFrame(() => {
      fitView();
    });
  };
  const columns: ColumnsType<Record<string, string>> = [
    {
      title: "汉字",
      dataIndex: "char",
      key: "char",
    },
    {
      title: "编码",
      dataIndex: "code",
      key: "code",
    },
  ];

  return (
    <Wrapper gutter={32} style={{ flex: "1", overflowY: "scroll" }}>
      <Col
        className="gutter-row"
        span={12}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <Typography.Title level={2}>图编辑器</Typography.Title>
        <div style={{ flex: "1" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
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
      <Col
        className="gutter-row"
        span={12}
        style={{ height: "100%", overflowY: "scroll" }}
      >
        <Typography.Title level={2}>编码生成</Typography.Title>
        <Toolbar>
          {/* <StrokeSearch sequence={sequence} setSequence={setSequence} /> */}
          <Button
            type="primary"
            onClick={() => {
              const cache = elements
                .map((config, i) => {
                  switch (config.type) {
                    case "字根":
                      return getRoot(wen, zi, yin, config);
                    case "字音":
                      return getPhonetic(yin, config);
                  }
                })
                .reduce((prev, curr) => {
                  return Object.assign({}, prev, curr);
                });
              setResult(encode(encoder, elements, characters, cache));
            }}
          >
            计算
          </Button>
          <Button onClick={() => {}}>清空</Button>
          <Button onClick={() => {}}>导出</Button>
        </Toolbar>
        <Table
          columns={columns}
          dataSource={Object.entries(result).map(([k, v]) => ({
            key: k,
            char: k,
            code: v,
          }))}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          size="small"
        />
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
