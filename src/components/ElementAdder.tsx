import { Button, Flex, notification } from "antd";
import {
  type 元素,
  合并字符串,
  type 强类型元素位或编码,
  type 强类型广义引用,
  是强类型变量,
} from "hanzi-chai";
import { useState } from "react";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  useMapAddAtom,
  全部合法元素原子,
  动态分析原子,
  字母表原子,
  强类型决策原子,
  强类型决策空间原子,
  当前元素原子,
  编码类型原子,
} from "~/atoms";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";

export default function ElementAdder() {
  const element = useAtomValue(当前元素原子);
  const alphabet = useAtomValue(字母表原子);
  const { 笔画列表 } = useAtomValueUnwrapped(全部合法元素原子);
  const mapping_type = useAtomValue(编码类型原子);
  const dynamic = useAtomValue(动态分析原子);
  const [main, setMain] = useState<元素>(笔画列表[0]!);
  const [keys, setKeys] = useState<强类型广义引用[]>([
    alphabet[0]!,
    "",
    "",
    "",
  ]);
  const addMapping = useMapAddAtom(强类型决策原子);
  const addMappingSpace = useMapAddAtom(强类型决策空间原子);
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
                    return i === index ? (event as 强类型元素位或编码) : v;
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
            const filteredSlice: 强类型元素位或编码[] = [];
            for (const x of slice) {
              if (是强类型变量(x) || x === null) {
                notification.error({
                  message: "不能将变量或占位符添加到当前决策中",
                });
                return;
              }
              filteredSlice.push(x);
            }
            addMapping(element!, 合并字符串(filteredSlice));
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
              addMappingSpace(element!, [{ value: slice, score: 0 }]);
            }}
          >
            备选
          </Button>
        )}
      </Flex>
      <Flex justify="center" align="center" gap="small">
        <span>设置归并</span>
        <ElementSelect value={main} onChange={setMain} />
        <Button
          type="primary"
          disabled={element === undefined || main === undefined}
          onClick={() => addMapping(element!, { element: main! })}
        >
          添加
        </Button>
        {dynamic && (
          <Button
            type="primary"
            disabled={element === undefined || main === undefined}
            onClick={() => {
              addMappingSpace(element!, [
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
