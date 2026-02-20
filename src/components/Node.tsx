import { Button, Dropdown, Tooltip } from "antd";
import { useContext, type PropsWithChildren } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import styled from "styled-components";
import type { SourceData, ConditionData } from "./graph";
import { CacheContext, renderType } from "./graph";
import { blue } from "@ant-design/colors";
import type { MenuItemGroupType, MenuItemType } from "antd/es/menu/interface";
import { sortBy } from "lodash-es";
import { 摘要, 条件节点配置, 源节点配置 } from "~/lib";

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

const sorter = (key: string) => Number.parseInt(key.slice(1), 10);

const getNewId = (sources: Record<string, any>, type: "s" | "c") => {
  let newId = 0;
  const keys = sortBy(Object.keys(sources), sorter);
  for (const currentId of keys) {
    if (currentId !== `${type}${newId}`) break;
    newId += 1;
  }
  return `${type}${newId}`;
};

const sortObject = <T,>(unordered: Record<string, T>) => {
  const keys = sortBy(Object.keys(unordered), sorter);
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
    const label = `添加子源节点${etype ? `（${renderType[etype]}）` : ""}`;
    return {
      key: `create-source-${etype}`,
      label,
      onClick: () => {
        const newId = getNewId(sources, "s");
        const defaultSource: 源节点配置 = {
          object: { type: "汉字" },
          next: null,
        };
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
    const label = `添加子条件节点${etype ? `（${renderType[etype]}）` : ""}`;
    return {
      key: `create-condition-${etype}`,
      label,
      onClick: () => {
        const newId = getNewId(conditions, "c");
        const newSources = { ...sources };
        const defaultCondition: 条件节点配置 = {
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
  // 获取当前节点的唯一子节点（如果有且仅有一个,没有分支）
  const getOnlyChild = (): string | null => {
    if (id[0] === "s") {
      return sources[id]?.next ?? null;
    }
    const cond = conditions[id];
    if (!cond) return null;
    const { positive, negative } = cond;
    if (positive && !negative) return positive;
    if (negative && !positive) return negative;
    return null; // 两个分支都有或都没有
  };

  // 将父节点中指向 id 的指针替换为 replacement
  const relinkParent = (
    newSources: Record<string, 源节点配置>,
    newConditions: Record<string, 条件节点配置>,
    replacement: string | null,
  ) => {
    for (const value of Object.values(newSources)) {
      if (value.next === id) value.next = replacement;
    }
    for (const value of Object.values(newConditions)) {
      if (value.positive === id) value.positive = replacement;
      if (value.negative === id) value.negative = replacement;
    }
  };

  const deleteNodeOnly: MenuItemType = {
    key: "delete-only",
    label: "删除本节点",
    onClick: () => {
      const newSources = { ...sources };
      const newConditions = { ...conditions };
      const child = getOnlyChild();
      // 将父节点的指针指向子节点
      relinkParent(newSources, newConditions, child);
      // 仅删除当前节点
      delete newSources[id];
      delete newConditions[id];
      setSelected(undefined);
      setSources(newSources);
      setConditions(newConditions);
    },
  };

  const deleteNodeAndChildren: MenuItemType = {
    key: "delete-all",
    label: "删除本节点和后代节点",
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
      relinkParent(newSources, newConditions, null);
      setSelected(undefined);
      setSources(newSources);
      setConditions(newConditions);
    },
  };

  // 判断是否可以仅删除本节点（条件节点两个分支都有子节点时不允许）
  const canDeleteOnly = (): boolean => {
    if (id[0] === "s") return true;
    const cond = conditions[id];
    if (!cond) return false;
    // 两个分支都有子节点时，无法确定应将哪个接到父节点
    return !(cond.positive && cond.negative);
  };

  // 在当前节点上方插入一个新的源节点
  const insertParentSourceNode: MenuItemType = {
    key: "insert-parent-source",
    label: "插入父源节点",
    onClick: () => {
      const newId = getNewId(sources, "s");
      const newSources = sortObject({
        ...sources,
        [newId]: { object: { type: "汉字" } as any, next: id },
      });
      const newConditions = { ...conditions };
      // 将原来指向当前节点的父节点改为指向新节点
      for (const value of Object.values(newSources)) {
        if (value !== newSources[newId] && value.next === id)
          value.next = newId;
      }
      for (const value of Object.values(newConditions)) {
        if (value.positive === id) value.positive = newId;
        if (value.negative === id) value.negative = newId;
      }
      setSources(newSources);
      setConditions(newConditions);
      setSelected(newId);
    },
  };

  // 在当前节点上方插入一个新的条件节点
  const insertParentConditionNode: MenuItemType = {
    key: "insert-parent-condition",
    label: "插入父条件节点",
    onClick: () => {
      const newId = getNewId(conditions, "c");
      const newSources = { ...sources };
      const newConditions = sortObject({
        ...conditions,
        [newId]: {
          object: { type: "汉字" } as const,
          operator: "存在" as const,
          positive: id,
          negative: null,
        },
      });
      // 将原来指向当前节点的父节点改为指向新节点
      for (const value of Object.values(newSources)) {
        if (value.next === id) value.next = newId;
      }
      for (const [key, value] of Object.entries(newConditions)) {
        if (key === newId) continue;
        if (value.positive === id) value.positive = newId;
        if (value.negative === id) value.negative = newId;
      }
      setSources(newSources);
      setConditions(newConditions);
      setSelected(newId);
    },
  };

  const items: (MenuItemType | MenuItemGroupType)[] = [];
  if (id[0] === "s") {
    if (id !== "s0") {
      items.push(insertParentSourceNode, insertParentConditionNode);
      if (canDeleteOnly()) items.push(deleteNodeOnly);
      items.push(deleteNodeAndChildren);
    }
    if (sources[id]?.next === null)
      items.push(createSourceNode(), createConditionNode());
  } else {
    items.push(insertParentSourceNode, insertParentConditionNode);
    if (canDeleteOnly()) items.push(deleteNodeOnly);
    items.push(deleteNodeAndChildren);
    for (const label of ["positive", "negative"] as const) {
      if (conditions[id]?.[label] === null)
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
        <Tooltip title={data.notes} placement="top">
          <SourceButton type={id === "s0" ? "primary" : "default"}>
            {data.object ? 摘要(data.object) + renderIndex(data.index) : "开始"}
          </SourceButton>
        </Tooltip>
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
        <Tooltip title={data.notes} placement="top">
          <ConditionButton type="dashed">
            {`${摘要(data.object)}: ${data.operator}?`}
          </ConditionButton>
        </Tooltip>
      </ContextMenu>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" id="positive" position={Position.Left} />
      <Handle type="source" id="negative" position={Position.Right} />
    </>
  );
};

export { SourceNode, ConditionNode };
