import { Button, Tabs } from "antd";
import { useState } from "react";
import ElementAdder from "./ElementAdder";
import ElementPool from "./ElementPool";
import styled from "styled-components";

interface ElementPickerProps<T extends string> {
  content: Map<T, string[]>;
}

const Wrapper = styled(Tabs)`
  & .ant-tabs-nav-wrap {
    transform: none !important;
  }
`;

const ElementPicker = function <T extends string>({
  content,
}: ElementPickerProps<T>) {
  const [element, setElement] = useState<string | undefined>(undefined);
  const defaultType = [...content.keys()][0]!;
  const [mode, setMode] = useState<T>(defaultType);
  return (
    <>
      <Wrapper
        activeKey={mode}
        tabBarExtraContent={<Button>添加</Button>}
        items={[...content].map(([name, elements]) => {
          return {
            label: name,
            key: name,
            children: (
              <ElementPool
                element={element}
                setElement={setElement}
                content={elements}
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
