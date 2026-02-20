import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAtom, 源映射原子, 条件映射原子 } from "~/atoms";
import "reactflow/dist/style.css";
import { SourceNode, ConditionNode } from "./Node";
import type { SourceData, ConditionData } from "./graph";
import {
  makeSourceNode,
  makeConditionNode,
  getLayoutedElements,
  makeEdge,
  CacheContext,
} from "./graph";
import DetailEditor from "./DetailEditor";
import { Button, Modal } from "antd";
import { 条件节点配置, 源节点配置 } from "~/lib";

const initializeGraph = (
  sources: Record<string, 源节点配置>,
  conditions: Record<string, 条件节点配置>,
) => {
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
  return [layoutNodes, layoutEdges] as const;
};

function EncoderGraph({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { fitView } = useReactFlow<SourceData | ConditionData>();
  const [sources, setSources] = useAtom(源映射原子);
  const [conditions, setConditions] = useAtom(条件映射原子);
  const [cachedSources, setCachedSources] = useState(sources);
  const [cachedConditions, setCachedConditions] = useState(conditions);

  // 每次打开 Modal 时，从原子状态重置缓存，确保取消后再次打开不会丢失数据
  useEffect(() => {
    if (open) {
      setCachedSources(sources);
      setCachedConditions(conditions);
    }
  }, [open]);

  const [initialNodes, initialEdges] = initializeGraph(
    cachedSources,
    cachedConditions,
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<
    SourceData | ConditionData
  >(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodeTypes = useMemo(
    () => ({ source: SourceNode, condition: ConditionNode }),
    [],
  );
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    nodes[0] && setSelected(nodes[0].id);
  }, []);

  useEffect(() => {
    const [reinitNodes, reinitEdges] = initializeGraph(
      cachedSources,
      cachedConditions,
    );
    setNodes(reinitNodes);
    setEdges(reinitEdges);
  }, [cachedSources, cachedConditions, setNodes, setEdges]);

  const context = useMemo(
    () => ({
      sources: cachedSources,
      setSources: setCachedSources,
      conditions: cachedConditions,
      setConditions: setCachedConditions,
      selected,
      setSelected,
    }),
    [
      cachedSources,
      setCachedSources,
      cachedConditions,
      setCachedConditions,
      selected,
      setSelected,
    ],
  );

  return (
    <Modal
      title="一字词全码"
      open={open}
      onCancel={() => setOpen(false)}
      onOk={() => {
        setSources(cachedSources);
        setConditions(cachedConditions);
        setOpen(false);
      }}
      width={1080}
    >
      <div style={{ height: "70vh" }}>
        <CacheContext.Provider value={context}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onSelectionChange={onSelectionChange}
            onPaneClick={() => setSelected(undefined)}
            nodeDragThreshold={10000}
            fitView
          >
            <Background variant={BackgroundVariant.Cross} gap={32} />
            <Controls />
            {selected && (
              <DetailEditor
                selected={selected}
                data={cachedSources[selected] || cachedConditions[selected]}
                setData={(data) => {
                  if ("operator" in data) {
                    setCachedConditions({
                      ...cachedConditions,
                      [selected]: data,
                    });
                  } else {
                    setCachedSources({ ...cachedSources, [selected]: data });
                  }
                }}
              />
            )}
          </ReactFlow>
        </CacheContext.Provider>
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
