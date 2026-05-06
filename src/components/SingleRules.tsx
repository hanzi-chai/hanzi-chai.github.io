import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import { atom, useAtom, 条件映射原子, 源映射原子 } from "~/atoms";
import "@xyflow/react/dist/style.css";
import { Button, Modal } from "antd";
import type { 条件节点配置, 源节点配置 } from "hanzi-chai";
import DetailEditor from "./DetailEditor";
import type { CNode, SNode } from "./graph";
import {
  CacheContext,
  getLayoutedElements,
  makeConditionNode,
  makeEdge,
  makeSourceNode,
} from "./graph";
import { ConditionNode, SourceNode } from "./Node";

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
  const initialNodes: (SNode | CNode)[] = [...sourceNodes, ...conditionNodes];
  const initialEdges = [];
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

export const selectedAtom = atom<string | undefined>(undefined);

function EncoderGraph({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [sources, setSources] = useAtom(源映射原子);
  const [conditions, setConditions] = useAtom(条件映射原子);
  const [cachedSources, setCachedSources] = useState(sources);
  const [cachedConditions, setCachedConditions] = useState(conditions);
  const [selected, setSelected] = useAtom(selectedAtom);

  useEffect(() => {
    if (open) {
      setCachedSources(sources);
      setCachedConditions(conditions);
    }
  }, [open]);

  const [nodes, edges] = useMemo(() => {
    const [layoutNodes, layoutEdges] = initializeGraph(
      cachedSources,
      cachedConditions,
    );
    return [
      layoutNodes.map((node) => ({ ...node, selected: node.id === selected })),
      layoutEdges,
    ] as const;
  }, [cachedSources, cachedConditions, selected]);

  const nodeTypes = useMemo(
    () => ({ source: SourceNode, condition: ConditionNode }),
    [],
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
      <div className="h-[70vh]">
        <CacheContext.Provider
          value={{
            sources: cachedSources,
            setSources: setCachedSources,
            conditions: cachedConditions,
            setConditions: setCachedConditions,
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelected(node.id)}
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
