import { useState } from "react";
import { Select, Button, Flex } from "antd";
import { useDesign, useGenericConfig, useConfigType } from "./context";
import { RootSelect } from "./Utils";

const ElementAdder = ({ element }: { element?: string }) => {
  const { alphabet, maxcodelen, mapping } = useGenericConfig();
  const index = useConfigType();
  const design = useDesign();
  const [main, setMain] = useState(Object.keys(mapping)[0]);
  const [keys, setKeys] = useState(Array(4).fill(alphabet[0]));
  const alphabetOptions = Array.from(alphabet).map((x) => ({
    label: x,
    value: x,
  }));
  const allOptions = [{ label: "无", value: "" }].concat(alphabetOptions);
  return (
    <>
      <Flex justify="center" align="center" gap="small">
        <span>添加至</span>
        {keys.slice(0, maxcodelen).map((key, index) => {
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
          onClick={() =>
            element &&
            design({
              subtype: "generic-mapping",
              action: "add",
              key: element,
              value: keys.slice(0, maxcodelen).join(""),
            })
          }
        >
          添加
        </Button>
      </Flex>
      {index === "form" && (
        <Flex justify="center" align="center" gap="small">
          <span>归并至</span>
          <RootSelect
            char={undefined}
            onChange={(event) => setMain(event)}
            exclude=""
          />
          <Button
            type="primary"
            disabled={
              element === undefined || Object.keys(mapping).length === 0
            }
            onClick={() => {
              design({
                subtype: "generic-grouping",
                action: "add",
                key: element!,
                value: main,
              });
              design({
                subtype: "generic-mapping",
                action: "remove",
                key: element!,
              });
            }}
          >
            归并
          </Button>
        </Flex>
      )}
    </>
  );
};

export default ElementAdder;
