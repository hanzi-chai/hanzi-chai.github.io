import { useState } from "react";
import { Button, Flex } from "antd";
import {
  useAtomValue,
  useAddAtom,
  mappingAtom,
  alphabetAtom,
  mappingTypeAtom,
} from "~/atoms";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";
import type { Key } from "~/lib";
import { joinKeys } from "~/lib";

export default function ElementAdder({ element }: { element?: string }) {
  const alphabet = useAtomValue(alphabetAtom);
  const mapping_type = useAtomValue(mappingTypeAtom);
  const [main, setMain] = useState<string | undefined>(undefined);
  const [keys, setKeys] = useState<Key[]>([alphabet[0]!, "", "", ""]);
  const addMapping = useAddAtom(mappingAtom);
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
