import styled from "styled-components";
import {
  classifierCustomizationAtom,
  customClassifierAtom,
  useAddAtom,
  useAtomValue,
  useSetAtom,
} from "~/atoms";
import { Button, Flex, Space, notification } from "antd";
import Root from "~/components/Element";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { blue } from "@ant-design/colors";
import { useChaifenTitle } from "~/lib/hooks";
import * as O from "optics-ts/standalone";
import { Feature } from "~/lib/classifier";

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
    <Root ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {name}
    </Root>
  );
}

const Drop = styled(Flex)`
  min-height: 48px;
  background-color: ${blue[1]};
  flex: 1;
  padding: 8px;

  &:empty {
    display: flex;
  }
`;

const Droppable = ({ id, children }: PropsWithChildren<{ id: number }>) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  const style = {
    color: isOver ? "green" : undefined,
  };
  return (
    <Drop ref={setNodeRef} style={style} gap="small" wrap="wrap">
      {children}
    </Drop>
  );
};

const Classifier = () => {
  useChaifenTitle("笔画分类数据");
  const classifier = useAtomValue(customClassifierAtom);
  const add = useAddAtom(classifierCustomizationAtom);
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
          add(active.id as Feature, over.id as number);
        }
      }}
    >
      <Space direction="vertical">
        {items.map(([x, v]) => (
          <Flex gap="small" align="center" key={x}>
            <Root>{x}</Root>
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
              if (items[items.length - 1]![1].length) {
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
};

export default Classifier;
