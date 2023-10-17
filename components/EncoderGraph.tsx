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
  Node,
  Edge,
} from "reactflow";
import { ConfigContext, DispatchContext, useAll } from "./context";

import "reactflow/dist/style.css";
import { SourceNode, ConditionNode } from "./Node";
import { Condition, Config, Source } from "../lib/config";
import EncoderEdge from "./EncoderEdge";
import {
  SourceData,
  SNode,
  makeSourceNode,
  ConditionData,
  CNode,
  makeConditionNode,
  getLayoutedElements,
  makeEdge,
} from "./graph";

import "reactflow/dist/style.css";

const EncoderGraph = () => {
  const { fitView } = useReactFlow();
  const { elements, encoder } = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);
  const n1 = encoder.sources.map((data, index) =>
    makeSourceNode(data, `s${index}`),
  );
  const n2 = encoder.conditions.map((data, index) =>
    makeConditionNode(data, `c${index}`),
  );
  const initialNodes: Node[] = [...n1, ...n2];
  const initialEdges: Edge[] = [];
  for (const [index, { next }] of encoder.sources.entries()) {
    if (next) {
      initialEdges.push(makeEdge(`s${index}`, next));
    }
  }
  for (const [index, { positive, negative }] of encoder.conditions.entries()) {
    if (positive) {
      initialEdges.push(makeEdge(`c${index}`, positive, "positive"));
    }
    if (negative) {
      initialEdges.push(makeEdge(`c${index}`, negative, "negative"));
    }
  }
  console.log(initialNodes, initialEdges);
  const [layoutNodes, layoutEdges] = getLayoutedElements(
    initialNodes,
    initialEdges,
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<
    SourceData | ConditionData
  >(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const nodeTypes = useMemo(
    () => ({ source: SourceNode, condition: ConditionNode }),
    [],
  );

  useEffect(() => {
    const idmap = {} as Record<string, string>;
    const sources: Source[] = [];
    const conditions: Condition[] = [];
    let sourceCount = 0,
      conditionCount = 0;
    nodes.forEach(({ id, data }) => {
      if ("operator" in data) {
        idmap[id] = `c${conditionCount}`;
        conditions.push({ ...data, positive: null, negative: null });
        conditionCount += 1;
      } else {
        idmap[id] = `s${sourceCount}`;
        sources.push({ ...data, next: null });
        sourceCount += 1;
      }
    });
    edges.forEach(({ source, target, label }) => {
      const [from, to] = [idmap[source], idmap[target]];
      const fromNumber = parseInt(from.slice(1));
      if (label === undefined) {
        sources[fromNumber].next = to;
      } else if (label === "是") {
        conditions[fromNumber].positive = to;
      } else {
        conditions[fromNumber].negative = to;
      }
    });
    dispatch({ type: "encoder", value: { sources, conditions } });
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
      // edgeTypes={edgeTypes}
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
