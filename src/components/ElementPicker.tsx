import { Tabs } from "antd";
import { useState } from "react";
import ElementAdder from "./ElementAdder";
import ElementPool from "./ElementPool";

interface ElementPickerProps<T extends string> {
  types: readonly T[];
  defaultType: T;
  contentMap: Record<T, string[]>;
}

const ElementPicker = function <T extends string>({
  types,
  defaultType,
  contentMap,
}: ElementPickerProps<T>) {
  const [element, setElement] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<T>(defaultType);
  return (
    <>
      <Tabs
        activeKey={mode}
        centered
        items={types.map((a) => {
          return {
            label: a,
            key: a,
            children: (
              <ElementPool
                element={element}
                setElement={setElement}
                content={contentMap[a]}
              />
            ),
          };
        })}
        onChange={(e) => {
          setMode(e as T);
        }}
      />
      <ElementAdder element={element} />
    </>
  );
};

export default ElementPicker;
