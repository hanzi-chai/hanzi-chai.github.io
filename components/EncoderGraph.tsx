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
import { ConfigContext, DispatchContext, useAll } from "./context";

import "reactflow/dist/style.css";
import EncoderNode from "./EncoderNode";
import { EncoderNode as IEncoderNode } from "../lib/config";
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

import "reactflow/dist/style.css";

const EncoderGraph = () => {
  const { fitView } = useReactFlow();
  const { elements, encoder } = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);
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
  );
};

export default EncoderGraph;
