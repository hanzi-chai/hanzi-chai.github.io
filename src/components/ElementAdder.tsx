import { useState } from "react";
import { Button, Flex } from "antd";
import {
  useAtomValue,
  useAddAtom,
  决策原子,
  字母表原子,
  编码类型原子,
} from "~/atoms";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";
import { 合并字符串, 码位 } from "~/lib";

export default function ElementAdder({ element }: { element?: string }) {
  const alphabet = useAtomValue(字母表原子);
  const mapping_type = useAtomValue(编码类型原子);
  const [main, setMain] = useState<string | undefined>(undefined);
  const [keys, setKeys] = useState<码位[]>([alphabet[0]!, "", "", ""]);
  const addMapping = useAddAtom(决策原子);
  return (
    <>
      <Flex justify="center" align="center" gap="small">
        <span>添加至</span>
        {keys.slice(0, mapping_type ?? 1).map((key, index) => {
          return (
            <KeySelect
              key={index}
              value={key}
              allowEmpty={index !== 0}
              onChange={(event) =>
                setKeys((keys) =>
                  keys.map((v, i) => {
                    return i === index ? (event as 码位) : v;
                  }),
                )
              }
              allowAlphabets
              allowElements
            />
          );
        })}
        <Button
          type="primary"
          disabled={element === undefined}
          onClick={() => {
            const slice = keys.slice(0, mapping_type).filter((x) => x !== "");
            addMapping(element!, 合并字符串(slice));
          }}
        >
          添加
        </Button>
      </Flex>
      <Flex justify="center" align="center" gap="small">
        <span>归并至</span>
        <ElementSelect value={undefined} onChange={(event) => setMain(event)} />
        <Button
          type="primary"
          disabled={element === undefined || main === undefined}
          onClick={() => addMapping(element!, { element: main! })}
        >
          归并
        </Button>
      </Flex>
    </>
  );
}
