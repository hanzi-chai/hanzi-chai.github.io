import { Edge, Node } from "reactflow";
import { Condition } from "../lib/config";
import { layout, graphlib, Label } from "@dagrejs/dagre";

export interface NodeData {
  label: string;
}

export type ENode = Node<NodeData>;

export const makeNode = (id: number, key: string) => {
  return {
    type: "encoder",
    width: 64,
    height: 32,
    id: id.toString(),
    data: { label: key },
    position: { x: 0, y: 0 },
  };
};

export type EdgeData = Condition[];
export type EEdge = Edge<EdgeData>;

export const makeEdge = (from: number, to: number, data: EdgeData) => {
  return {
    id: `${from}-${to}`,
    source: from.toString(),
    target: to.toString(),
    type: "encoder",
    animated: true,
    data,
  };
};

export const getLayoutedElements = function (
  nodes: ENode[],
  edges: EEdge[],
): [ENode[], EEdge[]] {
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
