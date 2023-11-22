import React, { useContext, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useOnSelectionChange,
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  Connection,
  Node,
  Edge,
  Panel,
} from "reactflow";
import { DispatchContext, useEncoder } from "./context";

import "reactflow/dist/style.css";
import { SourceNode, ConditionNode } from "./Node";
import { Condition, Config, Source } from "~/lib/config";
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
import DetailEditor from "./DetailEditor";

const EncoderGraph = () => {
  const { fitView, getNode } = useReactFlow();
  const { sources, conditions } = useEncoder();
  const dispatch = useContext(DispatchContext);
  const n1 = Object.entries(sources).map(([id, data]) =>
    makeSourceNode(data, id),
  );
  const n2 = Object.entries(conditions).map(([id, data]) =>
    makeConditionNode(data, id),
  );
  const initialNodes: Node[] = [...n1, ...n2];
  const initialEdges: Edge[] = [];
  for (const [id, { next }] of Object.entries(sources)) {
    if (next) {
      initialEdges.push(makeEdge(id, next));
    }
  }
  for (const [id, { positive, negative }] of Object.entries(conditions)) {
    if (positive) {
      initialEdges.push(makeEdge(id, positive, "positive"));
    }
    if (negative) {
      initialEdges.push(makeEdge(id, negative, "negative"));
    }
  }
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
  const [selected, setSelected] = useState<string | undefined>(undefined);

  useEffect(() => {
    const idmap = {} as Record<string, string>;
    const sources: Record<string, Source> = {};
    const conditions: Record<string, Condition> = {};
    let sourceCount = 0,
      conditionCount = 0,
      newid: string;
    nodes.forEach(({ id, data }) => {
      if ("operator" in data) {
        newid = `c${conditionCount}`;
        idmap[id] = newid;
        conditions[newid] = { ...data, positive: null, negative: null };
        conditionCount += 1;
      } else {
        newid = `s${sourceCount}`;
        idmap[id] = newid;
        sources[newid] = { ...data, next: null };
        sourceCount += 1;
      }
    });
    edges.forEach(({ source, target, label }) => {
      const [from, to] = [idmap[source]!, idmap[target]!];
      if (label === undefined) {
        sources[from]!.next = to;
      } else if (label === "是") {
        conditions[from]!.positive = to;
      } else {
        conditions[from]!.negative = to;
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
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={({ nodes, edges }) => {
        nodes[0] && setSelected(nodes[0].id);
      }}
      onNodesDelete={() => setSelected(undefined)}
      onConnect={onConnect}
      onPaneClick={() => setSelected(undefined)}
      nodeDragThreshold={10000}
      fitView
    >
      <Background variant={BackgroundVariant.Cross} gap={32} />
      <Controls />
      {selected && getNode(selected) && <DetailEditor selected={selected} />}
    </ReactFlow>
  );
};

export default EncoderGraph;
