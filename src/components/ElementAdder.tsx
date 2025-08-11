import { useState } from "react";
import { Button, Flex } from "antd";
import {
  keyboardAtom,
  useAtomValue,
  useAddAtom,
  mappingAtom,
  groupingAtom,
  useRemoveAtom,
  alphabetAtom,
  mappingTypeAtom,
} from "~/atoms";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";
import type { Key } from "~/lib";
import { joinKeys } from "~/lib";

export default function ElementAdder({ element }: { element?: string }) {
  const alphabet = useAtomValue(alphabetAtom);
  const mapping = useAtomValue(mappingAtom);
  const mapping_type = useAtomValue(mappingTypeAtom);
  const [main, setMain] = useState(Object.keys(mapping)[0]!);
  const [keys, setKeys] = useState<Key[]>([alphabet[0]!, "", "", ""]);
  const addMapping = useAddAtom(mappingAtom);
  const addGrouping = useAddAtom(groupingAtom);
  const removeMapping = useRemoveAtom(mappingAtom);
  const removeGrouping = useRemoveAtom(groupingAtom);
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
                    return i === index ? event : v;
                  }),
                )
              }
            />
          );
        })}
        <Button
          type="primary"
          disabled={element === undefined}
          onClick={() => {
            const slice = keys.slice(0, mapping_type ?? 1);
            addMapping(element!, joinKeys(slice));
            removeGrouping(element!);
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
          disabled={element === undefined || Object.keys(mapping).length === 0}
          onClick={() => {
            addMapping(element!, { element: main });
            removeGrouping(element!);
          }}
        >
          归并
        </Button>
      </Flex>
    </>
  );
}
