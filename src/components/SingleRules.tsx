import { useCallback, useMemo, useState } from "react";
import type { Connection, Node, Edge } from "reactflow";
import ReactFlow, {
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  ReactFlowProvider,
} from "reactflow";
import { useAtom, sourcesAtom, conditionsAtom } from "~/atoms";
import "reactflow/dist/style.css";
import { SourceNode, ConditionNode } from "./Node";
import type { Condition, Source } from "~/lib";
import type { SourceData, ConditionData } from "./graph";
import {
  makeSourceNode,
  makeConditionNode,
  getLayoutedElements,
  makeEdge,
} from "./graph";
import DetailEditor from "./DetailEditor";
import { Button, Modal } from "antd";

function EncoderGraph({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { fitView } = useReactFlow<SourceData | ConditionData>();
  const [sources, setSources] = useAtom(sourcesAtom);
  const [conditions, setConditions] = useAtom(conditionsAtom);
  const sourceNodes = Object.entries(sources).map(([id, data]) =>
    makeSourceNode(data, id),
  );
  const conditionNodes = Object.entries(conditions).map(([id, data]) =>
    makeConditionNode(data, id),
  );
  const initialNodes: Node[] = [...sourceNodes, ...conditionNodes];
  const initialEdges: Edge[] = [];
  for (const [id, { next }] of Object.entries(sources)) {
    next && initialEdges.push(makeEdge(id, next));
  }
  for (const [id, { positive, negative }] of Object.entries(conditions)) {
    positive && initialEdges.push(makeEdge(id, positive, "positive"));
    negative && initialEdges.push(makeEdge(id, negative, "negative"));
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
  const [selected, setSelected] = useState<Node | undefined>(undefined);

  const onConnect = (connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    const [lnodes, ledges] = getLayoutedElements(nodes, edges);
    setNodes([...lnodes]);
    setEdges([...ledges]);
    window.requestAnimationFrame(() => {
      fitView();
    });
  };

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    nodes[0] && setSelected(nodes[0]);
  }, []);

  return (
    <Modal
      title="一字词全码"
      open={open}
      onCancel={() => setOpen(false)}
      onOk={() => {
        const newSources: Record<string, Source> = {};
        const newConditions: Record<string, Condition> = {};
        nodes.forEach(({ id, data }) => {
          if ("operator" in data) {
            newConditions[id] = { ...data, positive: null, negative: null };
          } else {
            newSources[id] = { ...data, next: null };
          }
        });
        edges.forEach(({ source, target, label }) => {
          if (label === undefined) {
            newSources[source]!.next = target;
          } else if (label === "是") {
            newConditions[source]!.positive = target;
          } else {
            newConditions[source]!.negative = target;
          }
        });
        setSources(newSources);
        setConditions(newConditions);
        setOpen(false);
      }}
      width={1080}
    >
      <div style={{ height: "70vh" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          onNodesDelete={() => setSelected(undefined)}
          onConnect={onConnect}
          onPaneClick={() => setSelected(undefined)}
          nodeDragThreshold={10000}
          fitView
        >
          <Background variant={BackgroundVariant.Cross} gap={32} />
          <Controls />
          {selected && (
            <DetailEditor
              selected={selected.id}
              data={selected.data}
              setData={(data) => {
                setNodes(
                  nodes.map((node) =>
                    node.id === selected.id ? { ...node, data } : node,
                  ),
                );
              }}
            />
          )}
        </ReactFlow>
      </div>
    </Modal>
  );
}

export default function SingleRules() {
  const [open, setOpen] = useState(false);
  return (
    <ReactFlowProvider>
      <Button onClick={() => setOpen(true)}>配置一字词规则</Button>
      <EncoderGraph open={open} setOpen={setOpen} />
    </ReactFlowProvider>
  );
}
