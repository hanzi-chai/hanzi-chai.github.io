import React, { useContext, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  Connection,
} from "reactflow";
import { Button, Typography } from "antd";
import { ConfigContext, DispatchContext, useAll } from "./context";

import "reactflow/dist/style.css";
import encode from "../lib/encoder";
import Table, { ColumnsType } from "antd/es/table";
import EncoderNode from "./EncoderNode";
import { ElementCache, EncoderNode as IEncoderNode } from "../lib/config";
import EncoderEdge from "./EncoderEdge";
import {
  ENode,
  NodeData,
  makeNode,
  EEdge,
  EdgeData,
  makeEdge,
  getLayoutedElements,
} from "./graph";
import { getRoot } from "../lib/root";
import { getPhonetic } from "../lib/pinyin";
import { FlexContainer, EditorColumn, EditorRow } from "./Utils";

const isGB = (char: string) => {
  return char.charCodeAt(0) >= 0x4e00;
};

const Encoder = () => {
  const { fitView } = useReactFlow();
  const { elements, encoder } = useContext(ConfigContext);
  const initialNodes: ENode[] = encoder.map(({ key }, i) => makeNode(i, key));
  const initialEdges: EEdge[] = encoder
    .map(({ children }, from) => {
      return children.map(({ to, conditions }) => {
        return makeEdge(from, to, conditions);
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
  const data = useAll();
  const dispatch = useContext(DispatchContext);
  const characters = Object.keys(data.characters).filter(isGB);
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
  }, [nodes, edges, dispatch]);

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
  const onConnect = (connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    const [lnodes, ledges] = getLayoutedElements(nodes, edges);
    setNodes([...lnodes]);
    setEdges([...ledges]);
    window.requestAnimationFrame(() => {
      fitView();
    });
  };
  return (
    <EditorRow>
      <EditorColumn
        span={12}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <Typography.Title level={2}>编码器</Typography.Title>
        <div style={{ flex: 1 }}>
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
            <Background variant={BackgroundVariant.Cross} />
            <Controls />
          </ReactFlow>
        </div>
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>编码生成</Typography.Title>
        <FlexContainer>
          {/* <StrokeSearch sequence={sequence} setSequence={setSequence} /> */}
          <Button
            type="primary"
            onClick={() => {
              const cache = elements.map((config) => {
                switch (config.type) {
                  case "字根":
                    return getRoot(data, config);
                  case "字音":
                    return getPhonetic(data, config);
                }
              });
              const allcache = {} as ElementCache;
              for (const char in data.characters) {
                allcache[char] = cache
                  .map((a) => a[char])
                  .reduce((prev, curr) => Object.assign({}, prev, curr), {});
              }
              setResult(encode(encoder, elements, characters, allcache));
            }}
          >
            计算
          </Button>
          <Button onClick={() => {}}>清空</Button>
          <Button onClick={() => {}}>导出</Button>
        </FlexContainer>
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
      </EditorColumn>
    </EditorRow>
  );
};

const WrappedEncoder = () => {
  return (
    <ReactFlowProvider>
      <Encoder />
    </ReactFlowProvider>
  );
};

export default WrappedEncoder;
