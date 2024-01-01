import { useState } from "react";
import { Select, Button, Flex } from "antd";
import {
  configFormAtom,
  useAtomValue,
  useAddAtom,
  mappingAtom,
  groupingAtom,
  useRemoveAtom,
} from "~/atoms";
import { ElementSelect } from "./Utils";
import { alphabetOptionsAtom } from "./Mapping";

const ElementAdder = ({ element }: { element?: string }) => {
  const { alphabet, mapping_type, mapping } = useAtomValue(configFormAtom);
  const [main, setMain] = useState(Object.keys(mapping)[0]!);
  const [keys, setKeys] = useState([alphabet[0], "", "", ""]);
  const alphabetOptions = useAtomValue(alphabetOptionsAtom);

  const allOptions = [{ label: "无", value: "" }].concat(alphabetOptions);
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
            <Select
              key={index}
              value={key}
              onChange={(event) =>
                setKeys((keys) =>
                  keys.map((v, i) => {
                    return i === index ? event : v;
                  }),
                )
              }
              options={index ? allOptions : alphabetOptions}
            />
          );
        })}
        <Button
          type="primary"
          disabled={element === undefined}
          onClick={() => {
            addMapping(element!, keys.slice(0, mapping_type ?? 1).join(""));
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
