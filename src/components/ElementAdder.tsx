import { useState } from "react";
import { Select, Button, Flex } from "antd";
import {
  configFormAtom,
  useAtomValue,
  useSetAtom,
  addGenericGroupingAtom,
  addGenericMappingAtom,
  removeGenericGroupingAtom,
  removeGenericMappingAtom,
} from "~/atoms";
import { RootSelect } from "./Utils";

const ElementAdder = ({ element }: { element?: string }) => {
  const { alphabet, mapping_type, mapping } = useAtomValue(configFormAtom);
  const [main, setMain] = useState(Object.keys(mapping)[0]!);
  const [keys, setKeys] = useState([alphabet[0], "", "", ""]);
  const [groupingStyle, setGroupingStyle] = useState(-1);
  const allStyles = [-1].concat([...Array(mapping_type).keys()]);
  const alphabetOptions = Array.from(alphabet).map((x) => ({
    label: x,
    value: x,
  }));
  const allOptions = [{ label: "无", value: "" }].concat(alphabetOptions);
  const removeGenericGrouping = useSetAtom(removeGenericGroupingAtom);
  const addGenericMapping = useSetAtom(addGenericMappingAtom);
  const addGenericGrouping = useSetAtom(addGenericGroupingAtom);
  const removeGenericMapping = useSetAtom(removeGenericMappingAtom);
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
            addGenericMapping(
              element!,
              keys.slice(0, mapping_type ?? 1).join(""),
            );
            removeGenericGrouping(element!);
          }}
        >
          添加
        </Button>
      </Flex>
      <Flex justify="center" align="center" gap="small">
        <span>归并至</span>
        <RootSelect
          char={undefined}
          onChange={(event) => setMain(event)}
          exclude=""
        />
        {/* <Select style={{width: "128px"}} options={allStyles.map(x => ({
          value: x,
          label: x === -1 ? "完整归并" : `第 ${x + 1} 码归并`
        }))} value={groupingStyle} onChange={setGroupingStyle}/> */}
        <Button
          type="primary"
          disabled={element === undefined || Object.keys(mapping).length === 0}
          onClick={() => {
            addGenericGrouping(element!, main);
            removeGenericMapping(element!);
          }}
        >
          归并
        </Button>
      </Flex>
    </>
  );
};

export default ElementAdder;
