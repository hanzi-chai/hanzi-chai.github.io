import { layout, graphlib } from "@dagrejs/dagre";
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
  addEdge,
} from "reactflow";
import { Alert, Button, Col, Dropdown, MenuProps, Row, Typography } from "antd";
import styled from "styled-components";
import {
  CacheContext,
  ConfigContext,
  DispatchContext,
  WenContext,
  YinContext,
  ZiContext,
} from "./Context";

import "reactflow/dist/style.css";
import { Toolbar, getPhonetic, getRoot } from "./Analysis";
import encode from "../lib/encoder";
import Table, { ColumnsType } from "antd/es/table";
import EncoderNode, { ENode, NodeData, base } from "./EncoderNode";
import { ElementCache, EncoderNode as IEncoderNode } from "../lib/config";
import EncoderEdge, { EEdge, EdgeData } from "./EncoderEdge";
const Wrapper = styled(Row)``;

export const getLayoutedElements = function (
  nodes: Omit<ENode, "position">[],
  edges: EEdge[],
): [ENode[], EEdge[]] {
  const g = new graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 32, nodesep: 64 });
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) => g.setNode(node.id, node as any));
  layout(g);
  const position = (id: string) => ({ x: g.node(id).x, y: g.node(id).y });
  return [
    nodes.map((node) => ({ ...node, position: position(node.id) })),
    edges,
  ];
};

const isGB = (char: string) => {
  return char.charCodeAt(0) >= 0x4e00;
};

const Encoder = () => {
  const { fitView } = useReactFlow();
  const { elements, encoder } = useContext(ConfigContext);
  const initialNodes: Omit<ENode, "position">[] = encoder.map(({ key }, i) => {
    return { ...base, id: i.toString(), data: { label: key } };
  });
  const initialEdges: EEdge[] = encoder
    .map(({ children }, from) => {
      return children.map(({ to, conditions }) => {
        return {
          id: `${from}-${to}`,
          source: from.toString(),
          target: to.toString(),
          type: "encoder",
          animated: true,
          data: conditions,
        };
      });
    })
    .flat();
  const [layoutNodes, layoutEdges] = getLayoutedElements(
    initialNodes,
    initialEdges,
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>(layoutEdges);
  const [result, setResult] = useState<Record<string, string>>({});
  const wen = useContext(WenContext);
  const zi = useContext(ZiContext);
  const yin = useContext(YinContext);
  const dispatch = useContext(DispatchContext);
  const characters = Object.keys(yin).filter(isGB);
  const nodeTypes = useMemo(() => ({ encoder: EncoderNode }), []);
  const edgeTypes = useMemo(() => ({ encoder: EncoderEdge }), []);

  useEffect(() => {
    const idmap = {} as Record<string, number>;
    const newencoder: IEncoderNode[] = nodes.map(({ id, data }, index) => {
      idmap[id] = index;
      return { key: data.label, children: [] };
    });
    edges.forEach(({ source, target, data }) => {
      const [from, to] = [idmap[source], idmap[target]];
      newencoder[from].children.push({
        to,
        conditions: data!,
      });
    });
    dispatch({ type: "encoder", value: newencoder });
  }, [nodes, edges]);

  const onLayout = () => {
    const [lnodes, ledges] = getLayoutedElements(nodes, edges);
    setNodes([...lnodes]);
    setEdges([...ledges]);
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
  const onConnect = useCallback(
    (connection: any) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
      onLayout();
    },
    [setEdges],
  );
  return (
    <Wrapper gutter={32} style={{ flex: "1", overflowY: "scroll" }}>
      <Col
        className="gutter-row"
        span={12}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <Typography.Title level={2}>编码器</Typography.Title>
        <div style={{ flex: "1" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeDragThreshold={10000}
            fitView
          >
            {/* <Panel position="top-right">
              <Button onClick={onLayout}>整理布局</Button>
            </Panel> */}
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
              const cache = elements.map((config) => {
                switch (config.type) {
                  case "字根":
                    return getRoot(wen, zi, yin, config);
                  case "字音":
                    return getPhonetic(yin, config);
                }
              });
              const data = {} as ElementCache;
              for (const char in yin) {
                data[char] = cache
                  .map((a) => a[char])
                  .reduce((prev, curr) => Object.assign({}, prev, curr), {});
              }
              setResult(encode(encoder, elements, characters, data));
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
