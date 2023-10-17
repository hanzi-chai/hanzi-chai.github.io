import { Button, Dropdown } from "antd";
import { useContext } from "react";
import {
  Edge,
  Handle,
  Node,
  NodeProps,
  Position,
  useReactFlow,
} from "reactflow";
import { ConfigContext } from "./context";
import styled from "styled-components";
import {
  MenuItemGroupType,
  MenuItemType,
  SubMenuType,
} from "antd/es/menu/hooks/useItems";
import {
  SourceData,
  makeEdge,
  getLayoutedElements,
  ConditionData,
  makeSourceNode,
} from "./graph";

const SourceButton = styled(Button)`
  width: 64px;
  height: 32px;
  padding: 4px;
`;

const ConditionButton = styled(Button)`
  width: 96px;
  height: 32px;
  padding: 4px;
`;

const SourceNode = ({ id, data }: NodeProps<SourceData>) => {
  const { elements } = useContext(ConfigContext);
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow<
    SourceData | ConditionData
  >();
  const edges = getEdges();
  const allNodes = elements.map(({ nodes }) => nodes).flat();
  const updateNode: MenuItemGroupType = {
    key: "update",
    type: "group",
    label: "更改节点",
    children: allNodes
      .filter((v) => v !== data.label)
      .map((key) => ({
        key,
        label: key,
        onClick: () => {
          setNodes((nodes) =>
            nodes.map((node) => {
              if (node.id === id) {
                node.data = { label: key };
              }
              return node;
            }),
          );
        },
      })),
  };
  const setLayout = (newnodes: Node[], newedges: Edge[]) => {
    const [lnodes, ledges] = getLayoutedElements(newnodes, newedges);
    setNodes(lnodes);
    setEdges(ledges);
  };
  const createNode: SubMenuType = {
    key: "create",
    label: "添加节点",
    disabled: edges.some((v) => v.source === id),
    children: allNodes.map((label) => ({
      key: "create" + label,
      label: label,
      onClick: () => {
        const [nodes, edges] = [getNodes(), getEdges()];
        let newid = 0;
        for (const node of nodes) {
          if (node.id !== `s${newid}`) break;
          newid += 1;
        }
        const newnodes = nodes
          .concat(makeSourceNode({ label }, `s${newid}`))
          .sort((a, b) => {
            const [typea, typeb] = [a.id[0], b.id[0]];
            if (typea === "s" && typeb === "c") return -1;
            if (typea === "c" && typeb === "s") return 1;
            const [indexa, indexb] = [
              parseInt(a.id.slice(1)),
              parseInt(b.id.slice(1)),
            ];
            return indexa - indexb;
          });
        const newedges = edges.concat(makeEdge(id, `s${newid}`));
        setLayout(newnodes, newedges);
      },
    })),
  };
  const deleteNode: MenuItemType = {
    key: "delete",
    label: "删除节点",
    onClick: () => {
      const newnodes = getNodes().filter((n) => n.id !== id);
      const newedges = getEdges().filter(
        ({ source, target }) => ![source, target].includes(id),
      );
      setLayout(newnodes, newedges);
    },
  };
  const items: (MenuItemType | MenuItemGroupType)[] =
    id === "s0" ? [createNode] : [updateNode, createNode, deleteNode];

  return (
    <>
      <Dropdown menu={{ items }} placement="bottom">
        <SourceButton type={id === "s0" ? "primary" : "default"}>
          {data.label}
        </SourceButton>
      </Dropdown>
      {id !== "s0" && <Handle type="target" position={Position.Top} />}
      <Handle type="source" position={Position.Bottom} />
    </>
  );
};

const ConditionNode = ({ id, data }: NodeProps<ConditionData>) => {
  const { elements } = useContext(ConfigContext);
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow<
    SourceData | ConditionData
  >();
  const allNodes = elements.map(({ nodes }) => nodes).flat();

  return (
    <>
      <ConditionButton type="dashed">
        {data.label + ": " + data.operator}
      </ConditionButton>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" id="positive" position={Position.Left} />
      <Handle type="source" id="negative" position={Position.Right} />
    </>
  );
};

export { SourceNode, ConditionNode };
