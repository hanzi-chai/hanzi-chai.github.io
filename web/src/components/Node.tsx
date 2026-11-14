import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Button, Dropdown, Tooltip } from "antd";
import type { MenuItemGroupType, MenuItemType } from "antd/es/menu/interface";
import { 摘要, type 条件节点配置, type 源节点配置 } from "hanzi-chai";
import { useAtomValue, useSetAtom } from "jotai";
import { sortBy } from "lodash-es";
import { type ComponentProps, type PropsWithChildren, useContext } from "react";
import type { CNode, SNode } from "./graph";
import { CacheContext, renderType } from "./graph";
import { selectedAtom } from "./SingleRules";

const SourceButton = ({
  className,
  ...props
}: ComponentProps<typeof Button>) => (
  <Button
    className={`w-16! h-8! px-0! py-1! text-[0.8em]! ${className ?? ""}`}
    {...props}
  />
);

const ConditionButton = ({
  className,
  ...props
}: ComponentProps<typeof Button>) => (
  <SourceButton className={`rounded-none! ${className ?? ""}`} {...props} />
);

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
  const { sources, setSources, conditions, setConditions } =
    useContext(CacheContext);
  const setSelected = useSetAtom(selectedAtom);
  if (sources[id] === undefined && conditions[id] === undefined) return null;

  type Update = (
    s: Record<string, 源节点配置>,
    c: Record<string, 条件节点配置>,
  ) => [
    Record<string, 源节点配置>,
    Record<string, 条件节点配置>,
    string | undefined,
  ];

  const apply = (fn: Update) => {
    const [newS, newC, newSelected] = fn(sources, conditions);
    setSources(newS);
    setConditions(newC);
    setSelected(newSelected);
  };

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

  const getOnlyChild = (): string | null => {
    if (id[0] === "s") return sources[id]?.next ?? null;
    const cond = conditions[id];
    if (!cond) return null;
    const { positive, negative } = cond;
    if (positive && !negative) return positive;
    if (negative && !positive) return negative;
    return null;
  };

  const canDeleteOnly = (): boolean => {
    if (id[0] === "s") return true;
    const cond = conditions[id];
    if (!cond) return false;
    return !(cond.positive && cond.negative);
  };

  const createSourceNode: Creator = (etype) => ({
    key: `create-source-${etype}`,
    label: `添加子源节点${etype ? `（${renderType[etype]}）` : ""}`,
    onClick: (e) => {
      e.domEvent.stopPropagation();
      apply((s, c) => {
        const newId = getNewId(s, "s");
        const newSources = sortObject({
          ...s,
          [newId]: { object: { type: "汉字" }, next: null } as 源节点配置,
        });
        const newConditions = { ...c };
        if (etype === undefined) {
          newSources[id] = { ...newSources[id]!, next: newId };
        } else {
          newConditions[id] = { ...newConditions[id]!, [etype]: newId };
        }
        return [newSources, newConditions, newId];
      });
    },
  });

  const createConditionNode: Creator = (etype) => ({
    key: `create-condition-${etype}`,
    label: `添加子条件节点${etype ? `（${renderType[etype]}）` : ""}`,
    onClick: (e) => {
      e.domEvent.stopPropagation();
      apply((s, c) => {
        const newId = getNewId(c, "c");
        const newSources = { ...s };
        const newConditions = sortObject({
          ...c,
          [newId]: {
            object: { type: "汉字" },
            operator: "存在",
            positive: null,
            negative: null,
          } as 条件节点配置,
        });
        if (etype === undefined) {
          newSources[id] = { ...newSources[id]!, next: newId };
        } else {
          newConditions[id] = { ...newConditions[id]!, [etype]: newId };
        }
        return [newSources, newConditions, newId];
      });
    },
  });

  const deleteNodeOnly: MenuItemType = {
    key: "delete-only",
    label: "删除本节点",
    onClick: (e) => {
      e.domEvent.stopPropagation();
      apply((s, c) => {
        const newSources = { ...s };
        const newConditions = { ...c };
        relinkParent(newSources, newConditions, getOnlyChild());
        delete newSources[id];
        delete newConditions[id];
        return [newSources, newConditions, undefined];
      });
    },
  };

  const deleteNodeAndChildren: MenuItemType = {
    key: "delete-all",
    label: "删除本节点和后代节点",
    onClick: (e) => {
      e.domEvent.stopPropagation();
      apply((s, c) => {
        const newSources = { ...s };
        const newConditions = { ...c };
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
        return [newSources, newConditions, undefined];
      });
    },
  };

  const insertParentSourceNode: MenuItemType = {
    key: "insert-parent-source",
    label: "插入父源节点",
    onClick: (e) => {
      e.domEvent.stopPropagation();
      apply((s, c) => {
        const newId = getNewId(s, "s");
        const newSources = sortObject({
          ...s,
          [newId]: { object: { type: "汉字" } as any, next: id },
        });
        const newConditions = { ...c };
        for (const value of Object.values(newSources)) {
          if (value !== newSources[newId] && value.next === id)
            value.next = newId;
        }
        for (const value of Object.values(newConditions)) {
          if (value.positive === id) value.positive = newId;
          if (value.negative === id) value.negative = newId;
        }
        return [newSources, newConditions, newId];
      });
    },
  };

  const insertParentConditionNode: MenuItemType = {
    key: "insert-parent-condition",
    label: "插入父条件节点",
    onClick: (e) => {
      e.domEvent.stopPropagation();
      apply((s, c) => {
        const newId = getNewId(c, "c");
        const newSources = { ...s };
        const newConditions = sortObject({
          ...c,
          [newId]: {
            object: { type: "汉字" } as const,
            operator: "存在" as const,
            positive: id,
            negative: null,
          },
        });
        for (const value of Object.values(newSources)) {
          if (value.next === id) value.next = newId;
        }
        for (const [key, value] of Object.entries(newConditions)) {
          if (key === newId) continue;
          if (value.positive === id) value.positive = newId;
          if (value.negative === id) value.negative = newId;
        }
        return [newSources, newConditions, newId];
      });
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

const selectedClass =
  "text-[#4096ff]! border-[#4096ff]! [outline:1px_solid_#4096ff]!";

const SourceNode = ({ id, data }: NodeProps<SNode>) => {
  const selected = useAtomValue(selectedAtom);
  return (
    <>
      <ContextMenu id={id}>
        <Tooltip title={data.notes} placement="top">
          <SourceButton
            type={id === "s0" ? "primary" : "default"}
            className={id === selected ? selectedClass : ""}
          >
            {data.object ? 摘要(data.object) + renderIndex(data.index) : "开始"}
          </SourceButton>
        </Tooltip>
      </ContextMenu>
      {id !== "s0" && <Handle type="target" position={Position.Top} />}
      <Handle type="source" position={Position.Bottom} />
    </>
  );
};

const ConditionNode = ({ id, data }: NodeProps<CNode>) => {
  const selected = useAtomValue(selectedAtom);
  return (
    <>
      <ContextMenu id={id}>
        <Tooltip title={data.notes} placement="top">
          <ConditionButton
            type="dashed"
            className={id === selected ? selectedClass : ""}
          >
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

export { ConditionNode, SourceNode };
