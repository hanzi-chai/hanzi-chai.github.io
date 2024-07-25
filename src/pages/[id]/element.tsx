import Mapping from "~/components/Mapping";
import ElementPicker from "~/components/ElementPicker";
import {
  mappingAtom,
  useAddAtom,
  useAtomValue,
  useChaifenTitle,
} from "~/atoms";
import { DndContext } from "@dnd-kit/core";
import { Flex } from "antd";

export default function Element() {
  useChaifenTitle("元素");
  const mapping = useAtomValue(mappingAtom);
  const addMapping = useAddAtom(mappingAtom);
  return (
    <DndContext
      onDragEnd={({ active, over }) => {
        if (over === null) return;
        const activeId = active.id as string;
        const overId = over.id as string;
        const element = activeId.startsWith("onsite-")
          ? activeId.slice(7)
          : activeId;
        const current = mapping[element];
        if (!current) {
          addMapping(element, overId);
        } else {
          if (typeof current === "string") {
            if (overId === current[0]) return;
            const next = overId + current.slice(1);
            addMapping(element, next);
          } else {
            if (overId === current[0]) return;
            addMapping(element, [overId, ...current.slice(1)]);
          }
        }
      }}
    >
      <Flex gap="large">
        <ElementPicker />
        <Mapping />
      </Flex>
    </DndContext>
  );
}
