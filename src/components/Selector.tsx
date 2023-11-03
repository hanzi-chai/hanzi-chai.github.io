import { sieveMap } from "~/lib/selector";
import { EditorColumn, EditorRow, Select } from "./Utils";
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
import { SieveName } from "~/lib/config";
import { useDesign, useFormConfig } from "./context";
import { Button, Dropdown, Flex } from "antd";
import { MenuOutlined } from "@ant-design/icons";

const SortableItem = ({ sieve }: { sieve: SieveName }) => {
  const design = useDesign();

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sieve });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <Flex
      key={sieve}
      justify="space-evenly"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Button>
        <MenuOutlined />
      </Button>
      <Button>{sieve}</Button>
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

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = selector.indexOf(active.id);
      const newIndex = selector.indexOf(over.id);
      design({
        subtype: "root-selector",
        action: "replace",
        value: arrayMove(selector, oldIndex, newIndex),
      });
    }
  }

  return (
    <Flex vertical gap="small">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={selector}>
          {selector.map((sieve) => (
            <SortableItem sieve={sieve} key={sieve} />
          ))}
        </SortableContext>
      </DndContext>
      <Flex justify="center">
        <Dropdown
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
          <Button
            type="primary"
            disabled={selector.length === [...sieveMap.keys()].length}
          >
            添加
          </Button>
        </Dropdown>
      </Flex>
    </Flex>
  );
};

export default Selector;
