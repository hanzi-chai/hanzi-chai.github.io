import { useState } from "react";
import { FlexContainer } from "./Utils";
import { Select, Button } from "antd";
import { useDesign, useRoot } from "./context";

const ElementAdder = ({ name }: { name?: string }) => {
  const { alphabet } = useRoot();
  const design = useDesign();
  const [key, setKey] = useState(alphabet[0]);
  return (
    <FlexContainer>
      <span>添加至</span>
      <Select
        value={key}
        onChange={(event) => setKey(event)}
        options={Array.from(alphabet).map((x) => ({ key: x, value: x }))}
      />
      {/* {mode === "component" && (
      <Button disabled={name === undefined} onClick={showModal}>
        切片
      </Button>
    )} */}
      <Button
        type="primary"
        disabled={name === undefined}
        onClick={() =>
          name &&
          design({
            subtype: "generic-mapping",
            action: "add",
            key: name,
            value: key,
          })
        }
      >
        添加
      </Button>
    </FlexContainer>
  );
};

export default ElementAdder;
