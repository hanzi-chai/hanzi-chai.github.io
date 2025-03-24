import type { Edge, Node } from "reactflow";
import type { BinaryCondition, Condition, Source, UnaryCondition } from "~/lib";
import { add, sum } from "../lib/mathjs";
import { createContext } from "react";

export const CacheContext = createContext<{
  sources: Record<string, Source>;
  setSources: (sources: Record<string, Source>) => void;
  conditions: Record<string, Condition>;
  setConditions: (conditions: Record<string, Condition>) => void;
  selected: string | undefined;
  setSelected: (selected: string | undefined) => void;
}>({} as any);

export type SourceData = Omit<Source, "next">;

export type SNode = Node<SourceData>;

export const makeSourceNode = (data: SourceData, id: string): SNode => ({
  type: "source",
  width: 64,
  height: 32,
  id,
  data,
  position: { x: 0, y: 0 },
  selectable: id !== "s0",
});

export type ConditionData =
  | Omit<UnaryCondition, "positive" | "negative">
  | Omit<BinaryCondition, "positive" | "negative">;

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

export const renderType = {
  positive: "是",
  negative: "否",
};

export const makeEdge = (
  source: string,
  target: string,
  type?: string,
): Edge => ({
  id: `${source}-${target}`,
  source,
  sourceHandle: type,
  type: "smoothstep",
  target,
  animated: true,
  label: type && renderType[type as keyof typeof renderType],
});

export const getLayoutedElements = (
  nodes: (SNode | CNode)[],
  edges: Edge[],
): [(SNode | CNode)[], Edge[]] => {
  const graph = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        self: node,
        width: 0,
        position: [0, 0] as [number, number],
        children: [] as [string, string | undefined][],
      },
    ]),
  );
  edges.forEach(({ source, target, label }) => {
    graph[source]?.children.push([target, label as string]);
    graph[source]?.children.sort((a, b) => {
      if (a[1] === "是" && b[1] === "否") return -1;
      if (a[1] === "否" && b[1] === "是") return 1;
      return 0;
    });
  });

  const postdfs = (id: string) => {
    const childrefs = graph[id]!.children;
    if (!childrefs.length) {
      graph[id]!.width = 64;
    } else {
      for (const [cid] of childrefs) {
        postdfs(cid);
      }
      graph[id]!.width =
        sum(childrefs.map(([cid]) => graph[cid]!.width)) +
        (childrefs.length - 1) * 64;
    }
  };

  const predfs = (id: string) => {
    const position = graph[id]!.position;
    const childrefs = graph[id]!.children;
    if (!childrefs.length) return;
    if (childrefs.length === 1) {
      const [cid] = childrefs[0]!;
      graph[cid]!.position = add(position, [0, 64]);
      predfs(cid);
    } else {
      const [[cid1], [cid2]] = [childrefs[0]!, childrefs[1]!];
      const span = 64 + graph[cid1]!.width / 2 + graph[cid2]!.width / 2;
      graph[cid1]!.position = add(position, [-span / 2, 64]);
      graph[cid2]!.position = add(position, [span / 2, 64]);
      predfs(cid1);
      predfs(cid2);
    }
  };

  postdfs("s0");
  predfs("s0");

  // remove useless nodes
  return [
    nodes
      .filter((node) => graph[node.id]!.width)
      .map((node) => {
        const [x, y] = graph[node.id]!.position;
        return { ...node, position: { x, y } };
      }),
    edges.filter(
      ({ source, target }) =>
        graph[source]!.width > 0 && graph[target]!.width > 0,
    ),
  ];
};

export const sortNodes = (a: Node, b: Node) => {
  const indexa = Number.parseInt(a.id.slice(1), 10);
  const indexb = Number.parseInt(b.id.slice(1), 10);
  return indexa - indexb;
};
