import { Button, Dropdown } from "antd";
import { useContext, type PropsWithChildren } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import styled from "styled-components";
import type { SourceData, ConditionData } from "./graph";
import { CacheContext, renderType } from "./graph";
import type { Condition, Source } from "~/lib";
import { renderName } from "~/lib";
import { blue } from "@ant-design/colors";
import type { MenuItemGroupType, MenuItemType } from "antd/es/menu/interface";
import { sortBy } from "lodash-es";

const SourceButton = styled(Button)`
  width: 64px;
  height: 32px;
  padding: 4px 0;
  font-size: 0.8em;

  &:focus {
    color: ${blue[4]};
    border-color: ${blue[4]};
    outline: 2px solid ${blue[4]};
  }
`;

const ConditionButton = styled(SourceButton)`
  border-radius: 0;
`;

const getNewId = (sources: Record<string, any>, type: "s" | "c") => {
  let newId = 0;
  for (const currentId of Object.keys(sources)) {
    if (currentId !== `${type}${newId}`) break;
    newId += 1;
  }
  return `${type}${newId}`;
};

const sortObject = function <T>(unordered: Record<string, T>) {
  const keys = sortBy(Object.keys(unordered), (key) =>
    parseInt(key.slice(1), 10),
  );
  return keys.reduce(
    (obj, key) => {
      obj[key] = unordered[key]!;
      return obj;
    },
    {} as Record<string, T>,
  );
};

type Creator = (etype?: "positive" | "negative") => MenuItemType;

const ContextMenu = ({ id, children }: PropsWithChildren<{ id: string }>) => {
  const { sources, setSources, conditions, setConditions, setSelected } =
    useContext(CacheContext);
  if (sources[id] === undefined && conditions[id] === undefined) return null;
  const createSourceNode: Creator = (etype) => {
    const label = "添加源节点" + (etype ? `（${renderType[etype]}）` : "");
    return {
      key: `create-source-${etype}`,
      label,
      onClick: () => {
        const newId = getNewId(sources, "s");
        const defaultSource: Source = { object: { type: "汉字" }, next: null };
        const newSources = sortObject({ ...sources, [newId]: defaultSource });
        const newConditions = { ...conditions };
        if (etype === undefined) {
          newSources[id] = { ...newSources[id]!, next: newId };
        } else {
          newConditions[id] = {
            ...newConditions[id]!,
            [etype]: newId,
          };
        }
        setSources(newSources);
        setConditions(newConditions);
        setSelected(newId);
      },
    };
  };
  const createConditionNode: Creator = (etype) => {
    const label = "添加条件节点" + (etype ? `（${renderType[etype]}）` : "");
    return {
      key: `create-condition-${etype}`,
      label,
      onClick: () => {
        const newId = getNewId(conditions, "c");
        const newSources = { ...sources };
        const defaultCondition: Condition = {
          object: { type: "汉字" },
          operator: "存在",
          positive: null,
          negative: null,
        };
        const newConditions = sortObject({
          ...conditions,
          [newId]: defaultCondition,
        });
        if (etype === undefined) {
          newSources[id] = { ...newSources[id]!, next: newId };
        } else {
          newConditions[id] = {
            ...newConditions[id]!,
            [etype]: newId,
          };
        }
        setSources(newSources);
        setConditions(newConditions);
        setSelected(newId);
      },
    };
  };
  const deleteNode: MenuItemType = {
    key: "delete",
    label: "删除节点",
    onClick: () => {
      const newSources = { ...sources };
      const newConditions = { ...conditions };
      // 递归删除
      const stack = [id];
      while (stack.length) {
        const currentId = stack.pop()!;
        if (currentId[0] === "s") {
          const next = newSources[currentId]?.next;
          if (next) stack.push(next);
        } else {
          const positive = newConditions[currentId]?.positive;
          if (positive) stack.push(positive);
          const negative = newConditions[currentId]?.negative;
          if (negative) stack.push(negative);
        }
        delete newSources[currentId];
        delete newConditions[currentId];
      }
      for (const value of Object.values(newSources)) {
        if (value.next === id) value.next = null;
      }
      for (const value of Object.values(newConditions)) {
        if (value.positive === id) value.positive = null;
        if (value.negative === id) value.negative = null;
      }
      setSelected(undefined);
      setSources(newSources);
      setConditions(newConditions);
    },
  };
  const items: (MenuItemType | MenuItemGroupType)[] = [];
  if (id[0] === "s") {
    if (id !== "s0") items.push(deleteNode);
    if (sources[id]!.next === null)
      items.push(createSourceNode(), createConditionNode());
  } else {
    items.push(deleteNode);
    for (const label of ["positive", "negative"] as const) {
      if (conditions[id]![label] === null)
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
          {data.object
            ? renderName(data.object) + renderIndex(data.index)
            : "开始"}
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
