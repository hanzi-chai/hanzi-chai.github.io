import { Edge, Node } from "reactflow";
import { Condition, Source } from "../lib/config";
import { layout, graphlib, Label } from "@dagrejs/dagre";
import { render } from "react-dom";

export type SourceData = Omit<Source, "next">;

export type SNode = Node<SourceData>;

export const makeSourceNode = (data: SourceData, id: string) => {
  return {
    type: "source",
    width: 64,
    height: 32,
    id,
    data,
    position: { x: 0, y: 0 },
  };
};

export type ConditionData = Omit<Condition, "positive" | "negative">;

export type CNode = Node<ConditionData>;

export const makeConditionNode = (data: ConditionData, id: string) => {
  return {
    type: "condition",
    width: 64,
    height: 32,
    id,
    data,
    position: { x: 0, y: 0 },
  };
};

const renderType = {
  positive: "是",
  negative: "否",
};

export const makeEdge = function (
  source: string,
  target: string,
  type?: string,
): Edge {
  return {
    id: `${source}-${target}`,
    source,
    sourceHandle: type,
    target,
    animated: true,
    label: type && renderType[type as keyof typeof render],
  };
};

export const getLayoutedElements = function (
  nodes: (SNode | CNode)[],
  edges: Edge[],
): [(SNode | CNode)[], Edge[]] {
  const g = new graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 32, nodesep: 64 });
  nodes.forEach((node) => g.setNode(node.id, node as Label));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  layout(g);
  const position = (id: string) => ({ x: g.node(id).x, y: g.node(id).y });
  return [
    nodes.map((node) => ({ ...node, position: position(node.id) })),
    edges,
  ];
};
