import { useState } from "react";
import { Select, Button, Flex } from "antd";
import { useDesign, useRoot } from "./context";

const ElementAdder = ({ name }: { name?: string }) => {
  const { alphabet, maxcodelen } = useRoot();
  const design = useDesign();
  const initialKeys = Array(maxcodelen).fill("");
  initialKeys[0] = alphabet[0];
  const [keys, setKeys] = useState(initialKeys);
  const alphabetOptions = Array.from(alphabet).map((x) => ({
    label: x,
    value: x,
  }));
  const allOptions = [{ label: "无", value: "" }].concat(alphabetOptions);
  return (
    <Flex justify="center" align="center" gap="small">
      <span>添加至</span>
      {keys.map((key, index) => {
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
        disabled={name === undefined}
        onClick={() =>
          name &&
          design({
            subtype: "generic-mapping",
            action: "add",
            key: name,
            value: keys.join(""),
          })
        }
      >
        添加
      </Button>
    </Flex>
  );
};

export default ElementAdder;
