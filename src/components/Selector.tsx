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
import {
  useAtom,
  过滤器列表原子,
  useAppendAtom,
  useExcludeAtom,
  useAtomValue,
} from "~/atoms";

import { Button, Dropdown, Flex, Typography } from "antd";
import MenuOutlined from "@ant-design/icons/MenuOutlined";
import PrioritizedRoots from "./PrioritizedRoots";
import { 获取注册表 } from "~/lib";

const SortableItem = ({ sieve, index }: { sieve: string; index: number }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sieve });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const excludeSelector = useExcludeAtom(过滤器列表原子);
  return (
    <Flex key={sieve} justify="space-evenly">
      <Button ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <MenuOutlined />
        {sieve}
      </Button>
      <Button onClick={() => excludeSelector(index)}>删除</Button>
    </Flex>
  );
};

export default function Selector() {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [selector, setSelector] = useAtom(过滤器列表原子);
  const appendSelector = useAppendAtom(过滤器列表原子);
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = selector.indexOf(active.id as string);
      const newIndex = selector.indexOf(over.id as string);
      setSelector(arrayMove(selector, oldIndex, newIndex));
    }
  }

  const 注册表 = 获取注册表();

  return (
    <Flex vertical gap="small">
      <Typography.Title level={3}>拆分方式筛选</Typography.Title>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={selector}>
          {selector.map((sieve, index) => (
            <SortableItem sieve={sieve} key={sieve} index={index} />
          ))}
        </SortableContext>
      </DndContext>
      <Flex justify="center">
        <Dropdown
          disabled={selector.length === 注册表.筛选器映射.size}
          menu={{
            items: [...注册表.筛选器映射.keys()]
              .filter((x) => !selector.includes(x))
              .map((sieve) => ({
                key: sieve,
                label: sieve,
                onClick: () => appendSelector(sieve),
              })),
          }}
        >
          <Button type="primary">添加</Button>
        </Dropdown>
      </Flex>
      {selector.includes("多强字根") && <PrioritizedRoots variant="strong" />}
      {selector.includes("少弱字根") && <PrioritizedRoots variant="weak" />}
    </Flex>
  );
}
