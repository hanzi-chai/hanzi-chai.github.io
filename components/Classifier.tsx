import styled from "styled-components";
import { useClassifier, useModify } from "./context";
import { Button, notification } from "antd";
import { FlexContainer } from "./Utils";
import Root from "./Root";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { PropsWithChildren, useState } from "react";
import { blue } from "@ant-design/colors";

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

const Drop = styled(FlexContainer)`
  min-height: 48px;
  background-color: ${blue[1]};
  flex: 1;
  padding: 8px;
`;

const Droppable = ({ id, children }: PropsWithChildren<{ id: number }>) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  const style = {
    color: isOver ? "green" : undefined,
  };
  return (
    <Drop ref={setNodeRef} style={style}>
      {children}
    </Drop>
  );
};

const Classifier = () => {
  const classifier = useClassifier();
  const modify = useModify();
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
          console.log(active.id, over.id);
          modify(active.id as string, over.id as number);
        }
      }}
    >
      {items.map(([x, v]) => (
        <FlexContainer key={x}>
          <Root>{x}</Root>
          <Droppable id={x}>
            {v.map((s) => (
              <Draggable key={s} name={s} />
            ))}
          </Droppable>
        </FlexContainer>
      ))}
      <FlexContainer>
        <Button onClick={() => setCategories(categories + 1)}>增加分类</Button>
        <Button
          onClick={() => {
            if (items[items.length - 1][1].length) {
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
      </FlexContainer>
    </DndContext>
  );
};

export default Classifier;
