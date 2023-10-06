import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { useCallback, useContext } from "react";
import { Handle, NodeProps, Position, useReactFlow } from "reactflow";
import { ConfigContext } from "./Context";
import styled from "styled-components";
import { MenuItemGroupType, MenuItemType } from "antd/es/menu/hooks/useItems";

export interface NodeData {
  label: string;
}

const NodeButton = styled(Button)`
  width: 64px;
  height: 32px;
  padding: 4px;
`;

const EncoderNode = ({ id, data }: NodeProps<NodeData>) => {
  const { elements } = useContext(ConfigContext);
  const { setNodes } = useReactFlow<NodeData>();
  const allNodes = elements.map(({ nodes }) => nodes).flat();
  const updateNode = {
    key: "update",
    type: "group",
    label: "更改节点",
    children: allNodes.map((key) => ({
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
  const createNode = {
    key: "create",
    label: "添加节点",
  };
  const deleteNode = {
    key: "delete",
    label: "删除节点",
  };
  const items: (MenuItemType | MenuItemGroupType)[] =
    id === "0" ? [createNode] : [updateNode, createNode, deleteNode];

  return (
    <>
      <Dropdown menu={{ items }} placement="bottom">
        <NodeButton>{data.label}</NodeButton>
      </Dropdown>
      {id !== "0" && <Handle type="target" position={Position.Top} />}
      <Handle type="source" position={Position.Bottom} />
    </>
  );
};

export default EncoderNode;
