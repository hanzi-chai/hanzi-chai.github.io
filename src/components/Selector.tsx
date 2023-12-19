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
import {
  useSetAtom,
  useAtomValue,
  removeRootSelectorAtom,
  addRootSelectorAtom,
  configAnalysisAtom,
  replaceRootSelectorAtom,
} from "~/atoms";

import { Button, Dropdown, Flex, Space, Typography } from "antd";
import MenuOutlined from "@ant-design/icons/MenuOutlined";
import PrioritizedRoots from "./PrioritizedRoots";

const SortableItem = ({ sieve }: { sieve: SieveName }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sieve });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const removeRootSelector = useSetAtom(removeRootSelectorAtom);
  return (
    <Flex key={sieve} justify="space-evenly">
      <Button ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <MenuOutlined />
        {sieve}
      </Button>
      <Button onClick={() => removeRootSelector(sieve)}>删除</Button>
    </Flex>
  );
};

const Selector = () => {
  const selector = useAtomValue(configAnalysisAtom)?.selector ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const replaceRootSelector = useSetAtom(replaceRootSelectorAtom);
  const addRootSelector = useSetAtom(addRootSelectorAtom);
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = selector.indexOf(active.id as SieveName);
      const newIndex = selector.indexOf(over.id as SieveName);
      replaceRootSelector(arrayMove(selector, oldIndex, newIndex));
    }
  }

  return (
    <Flex vertical gap="small">
      <Typography.Title level={3}>拆分方式筛选</Typography.Title>
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
                onClick: () => addRootSelector(sieve),
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
};

export default Selector;
