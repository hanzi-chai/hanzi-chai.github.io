import { sieveMap } from "~/lib/selector";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SieveName } from "~/lib/config";
import { useDesign, useFormConfig } from "./context";
import { Button, Dropdown, Flex, Typography } from "antd";
import MenuOutlined from "@ant-design/icons/MenuOutlined";

const SortableItem = ({ sieve }: { sieve: SieveName }) => {
  const design = useDesign();

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sieve });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <Flex key={sieve} justify="space-evenly">
      <Button ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <MenuOutlined />
        {sieve}
      </Button>
      <Button
        onClick={() => {
          design({
            subtype: "root-selector",
            action: "remove",
            value: sieve,
          });
        }}
      >
        删除
      </Button>
    </Flex>
  );
};

const Selector = () => {
  const {
    analysis: { selector },
  } = useFormConfig();
  const design = useDesign();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = selector.indexOf(active.id as SieveName);
      const newIndex = selector.indexOf(over.id as SieveName);
      design({
        subtype: "root-selector",
        action: "replace",
        value: arrayMove(selector, oldIndex, newIndex),
      });
    }
  }

  return (
    <Flex vertical gap="small">
      <Typography.Title level={3}>拆分规则</Typography.Title>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={selector}>
          {selector.map((sieve) => (
            <SortableItem sieve={sieve} key={sieve} />
          ))}
        </SortableContext>
      </DndContext>
      <Flex justify="center">
        <Dropdown
          disabled={selector.length === [...sieveMap.keys()].length}
          menu={{
            items: ([...sieveMap.keys()] as SieveName[])
              .filter((x) => !selector.includes(x))
              .map((sieve) => ({
                key: sieve,
                label: sieve,
                onClick: () => {
                  design({
                    subtype: "root-selector",
                    action: "add",
                    value: sieve,
                  });
                },
              })),
          }}
        >
          <Button type="primary">添加</Button>
        </Dropdown>
      </Flex>
    </Flex>
  );
};

export default Selector;
