import { Button, Flex, Tabs } from "antd";
import { useState } from "react";
import ElementAdder from "./ElementAdder";
import ElementPool from "./ElementPool";
import styled from "styled-components";
import { algebraAtom, useAtom } from "~/atoms";
import { deepcopy } from "~/lib/utils";
import Algebra from "./Algebra";

interface ElementPickerProps<T extends string> {
  content: Map<T, string[]>;
  editable?: boolean;
}

const Wrapper = styled(Tabs)`
  & .ant-tabs-nav-wrap {
    transform: none !important;
  }
`;

const ElementPicker = function <T extends string>({
  content,
  editable,
}: ElementPickerProps<T>) {
  const [element, setElement] = useState<string | undefined>(undefined);
  const defaultType = [...content.keys()][0]!;
  const [mode, setMode] = useState<T>(defaultType);
  const [algebra, setAlgebra] = useAtom(algebraAtom);
  return (
    <>
      {editable && (
        <Flex justify="center" gap="middle">
          <Algebra title="新建元素类型" />
          <Algebra
            title="修改元素类型"
            disabled={algebra[mode] === undefined}
            initialValues={{ name: mode, rules: algebra[mode]! }}
          />
          <Button
            disabled={algebra[mode] === undefined}
            onClick={() => {
              const newAlgebra = deepcopy(algebra);
              delete newAlgebra[mode];
              setAlgebra(newAlgebra);
              setMode(defaultType);
            }}
          >
            删除元素类型
          </Button>
        </Flex>
      )}
      <Wrapper
        activeKey={mode}
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
