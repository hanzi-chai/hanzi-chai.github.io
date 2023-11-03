import { Button, Dropdown } from "antd";
import { PropsWithChildren, useContext } from "react";
import {
  Edge,
  Handle,
  Node,
  NodeProps,
  Position,
  useReactFlow,
} from "reactflow";
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
  sortNodes,
  makeConditionNode,
  renderType,
} from "./graph";
import { renderName } from "~/lib/element";
import { blue } from "@ant-design/colors";

const SourceButton = styled(Button)`
  width: 64px;
  height: 32px;
  padding: 4px 0;
  font-size: 0.8em;

  &:focus {
    color: ${blue[4]};
    border-color: ${blue[4]};
  }
`;

const ConditionButton = styled(SourceButton)`
  border-radius: 0;
`;

const ContextMenu = ({ id, children }: PropsWithChildren<{ id: string }>) => {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow<
    SourceData | ConditionData
  >();
  const nodes = getNodes();
  const edges = getEdges();
  const setLayout = (newnodes: Node[], newedges: Edge[]) => {
    const [lnodes, ledges] = getLayoutedElements(newnodes, newedges);
    setNodes(lnodes);
    setEdges(ledges);
  };
  const createSourceNode: (etype: string | undefined) => MenuItemType = (
    etype,
  ) => ({
    key: `create-source-${etype}`,
    label:
      "添加源节点" +
      (etype ? `（${renderType[etype as keyof typeof renderType]}）` : ""),
    onClick: () => {
      let newid = 0;
      for (const node of nodes.filter((x) => x.id[0] === "s")) {
        if (node.id !== `s${newid}`) break;
        newid += 1;
      }
      const newnodes = nodes
        .concat(makeSourceNode({ object: { type: "汉字" } }, `s${newid}`))
        .sort(sortNodes);
      const newedges = edges.concat(makeEdge(id, `s${newid}`, etype));
      setLayout(newnodes, newedges);
    },
  });
  const createConditionNode: (etype: string | undefined) => MenuItemType = (
    etype,
  ) => ({
    key: `create-condition-${etype}`,
    label:
      "添加条件节点" +
      (etype ? `（${renderType[etype as keyof typeof renderType]}）` : ""),
    onClick: () => {
      let newid = 0;
      for (const node of nodes.filter((x) => x.id[0] === "c")) {
        if (node.id !== `c${newid}`) break;
        newid += 1;
      }
      const newnodes = nodes
        .concat(
          makeConditionNode(
            { object: { type: "汉字" }, operator: "存在" },
            `c${newid}`,
          ),
        )
        .sort(sortNodes);
      const newedges = edges.concat(makeEdge(id, `c${newid}`, etype));
      setLayout(newnodes, newedges);
    },
  });
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
  let items: (MenuItemType | MenuItemGroupType)[] = [];
  if (id[0] === "s") {
    if (id !== "s0") items.push(deleteNode);
    if (!edges.some((e) => e.source === id))
      items.push(createSourceNode(undefined), createConditionNode(undefined));
  } else {
    items.push(deleteNode);
    for (const label of ["positive", "negative"]) {
      if (
        !edges.some(
          (e) =>
            e.source === id &&
            e.label === renderType[label as keyof typeof renderType],
        )
      )
        items.push(createSourceNode(label), createConditionNode(label));
    }
  }

  return (
    <Dropdown menu={{ items }} placement="bottom" trigger={["contextMenu"]}>
      {children}
    </Dropdown>
  );
};

const renderIndex = (index: number | undefined) => {
  return index === undefined ? "" : ` [${index + 1}]`;
};

const SourceNode = ({ id, data }: NodeProps<SourceData>) => {
  return (
    <>
      <ContextMenu id={id}>
        <SourceButton type={id === "s0" ? "primary" : "default"}>
          {data.object === undefined
            ? "开始"
            : renderName(data.object) + renderIndex(data.index)}
        </SourceButton>
      </ContextMenu>
      {id !== "s0" && <Handle type="target" position={Position.Top} />}
      <Handle type="source" position={Position.Bottom} />
    </>
  );
};

const ConditionNode = ({ id, data }: NodeProps<ConditionData>) => {
  return (
    <>
      <ContextMenu id={id}>
        <ConditionButton type="dashed">
          {renderName(data.object) + ": " + data.operator + "?"}
        </ConditionButton>
      </ContextMenu>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" id="positive" position={Position.Left} />
      <Handle type="source" id="negative" position={Position.Right} />
    </>
  );
};

export { SourceNode, ConditionNode };
