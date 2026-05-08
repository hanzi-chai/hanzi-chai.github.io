import { Button, Flex, notification } from "antd";
import { 合并字符串, type 广义码位, 是变量, type 码位 } from "hanzi-chai";
import { useState } from "react";
import {
  useAddAtom,
  useAtomValue,
  决策原子,
  决策空间原子,
  动态分析原子,
  字母表原子,
  当前元素原子,
  编码类型原子,
} from "~/atoms";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";

export default function ElementAdder() {
  const element = useAtomValue(当前元素原子);
  const alphabet = useAtomValue(字母表原子);
  const mapping_type = useAtomValue(编码类型原子);
  const dynamic = useAtomValue(动态分析原子);
  const [main, setMain] = useState<string | undefined>(undefined);
  const [keys, setKeys] = useState<广义码位[]>([alphabet[0]!, "", "", ""]);
  const addMapping = useAddAtom(决策原子);
  const addMappingSpace = useAddAtom(决策空间原子);
  return (
    <>
      <Flex justify="center" align="center" gap="small" wrap>
        <span>设置键位</span>
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
              allowVariables
            />
          );
        })}
        <Button
          type="primary"
          disabled={element === undefined}
          onClick={() => {
            const slice = keys.slice(0, mapping_type).filter((x) => x !== "");
            const filteredSlice: 码位[] = [];
            for (const x of slice) {
              if (是变量(x) || x === null) {
                notification.error({
                  message: "不能将变量或占位符添加到当前决策中",
                });
                return;
              }
              filteredSlice.push(x);
            }
            addMapping(element!.toString(), 合并字符串(filteredSlice));
          }}
        >
          添加
        </Button>
        {dynamic && (
          <Button
            type="primary"
            disabled={element === undefined}
            onClick={() => {
              const slice = keys.slice(0, mapping_type).filter((x) => x !== "");
              addMappingSpace(element!.toString(), [
                { value: slice, score: 0 },
              ]);
            }}
          >
            备选
          </Button>
        )}
      </Flex>
      <Flex justify="center" align="center" gap="small">
        <span>设置归并</span>
        <ElementSelect value={undefined} onChange={(event) => setMain(event)} />
        <Button
          type="primary"
          disabled={element === undefined || main === undefined}
          onClick={() => addMapping(element!.toString(), { element: main! })}
        >
          添加
        </Button>
        {dynamic && (
          <Button
            type="primary"
            disabled={element === undefined || main === undefined}
            onClick={() => {
              addMappingSpace(element!.toString(), [
                { value: { element: main! }, score: 0 },
              ]);
            }}
          >
            备选
          </Button>
        )}
      </Flex>
    </>
  );
}
