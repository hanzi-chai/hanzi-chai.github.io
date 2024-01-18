import { useState } from "react";
import { Select, Button, Flex } from "antd";
import {
  keyboardAtom,
  useAtomValue,
  useAddAtom,
  mappingAtom,
  groupingAtom,
  useRemoveAtom,
} from "~/atoms";
import ElementSelect from "./ElementSelect";
import KeySelect from "./KeySelect";
import { Key } from "~/lib";
import { joinKeys } from "./Utils";

const ElementAdder = ({ element }: { element?: string }) => {
  const { alphabet, mapping_type, mapping } = useAtomValue(keyboardAtom);
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
        <ElementSelect
          excludeGrouped
          char={undefined}
          onChange={(event) => setMain(event)}
        />
        {/* <Select style={{width: "128px"}} options={allStyles.map(x => ({
          value: x,
          label: x === -1 ? "完整归并" : `第 ${x + 1} 码归并`
        }))} value={groupingStyle} onChange={setGroupingStyle}/> */}
        <Button
          type="primary"
          disabled={element === undefined || Object.keys(mapping).length === 0}
          onClick={() => {
            addGrouping(element!, main);
            removeMapping(element!);
          }}
        >
          归并
        </Button>
      </Flex>
    </>
  );
};

export default ElementAdder;
