import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { Button, Flex, notification, Space } from "antd";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import {
  useAddAtom,
  useAtomValue,
  分类器原子,
  分类器自定义原子,
} from "~/atoms";
import BorderItem from "~/components/BorderItem";
import type { 笔画名称 } from "hanzi-chai";

function Draggable({ name }: { name: string }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: name,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <BorderItem ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {name}
    </BorderItem>
  );
}

const Droppable = ({ id, children }: PropsWithChildren<{ id: number }>) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <Flex
      ref={setNodeRef}
      className={`${isOver ? "text-green-500" : ""} min-h-[48px] bg-[#bae0ff] flex-1 p-2`}
      gap="small"
      wrap="wrap"
    >
      {children}
    </Flex>
  );
};

export default function Classifier() {
  const classifier = useAtomValue(分类器原子);
  const add = useAddAtom(分类器自定义原子);
  const [categories, setCategories] = useState(
    Math.max(...Object.values(classifier)),
  );
  const items = [...Array(categories).keys()]
    .map((n) => n + 1)
    .map((n) => {
      return [
        n,
        Object.entries(classifier)
          .filter(([, v]) => v === n)
          .map(([x]) => x),
      ] as [number, string[]];
    });
  return (
    <DndContext
      onDragEnd={(event) => {
        const { active, over } = event;
        if (over) {
          add(active.id as 笔画名称, over.id as number);
        }
      }}
    >
      <Space direction="vertical">
        {items.map(([x, v]) => (
          <Flex gap="small" align="center" key={x}>
            <BorderItem>{x}</BorderItem>
            <Droppable id={x}>
              {v.map((s) => (
                <Draggable key={s} name={s} />
              ))}
            </Droppable>
          </Flex>
        ))}
        <Flex justify="center" gap="middle">
          <Button onClick={() => setCategories(categories + 1)}>
            增加分类
          </Button>
          <Button
            onClick={() => {
              if (items[items.length - 1]?.[1].length) {
                notification.warning({
                  message: "不能删除分类",
                  description: "最后一个分类里还有笔画",
                });
              } else {
                setCategories(categories - 1);
              }
            }}
          >
            减少分类
          </Button>
        </Flex>
      </Space>
    </DndContext>
  );
}
