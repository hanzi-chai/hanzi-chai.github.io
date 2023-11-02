import { useState } from "react";
import { useDesign, useFormConfig } from "./context";
import { Button, Flex } from "antd";
import { ItemSelect, RootSelect, Select } from "./Utils";
import Char from "./Char";
import { PlusOutlined, MinusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useDisplay } from "./contants";

const AnalysisCustomizer = () => {
  const {
    analysis: { customize },
  } = useFormConfig();
  const design = useDesign();
  const display = useDisplay();
  const [newCustomization, setNew] = useState<string | undefined>(undefined);

  return (
    <>
      {Object.entries(customize).map(([component, sequence]) => {
        return (
          <Flex justify="space-between" key={component}>
            <Char>{display(component)}</Char>
            <Flex gap="small">
              {sequence.map((x, i) => (
                <RootSelect
                  withGrouped
                  key={i}
                  char={x}
                  onChange={(s) => {
                    design({
                      subtype: "root-customize",
                      action: "add",
                      key: component,
                      value: sequence.map((y, j) => (i === j ? s : y)),
                    });
                  }}
                  exclude=""
                />
              ))}
              <Button
                onClick={() => {
                  design({
                    subtype: "root-customize",
                    action: "add",
                    key: component,
                    value: sequence.concat("1"),
                  });
                }}
                icon={<PlusOutlined />}
              />
              <Button
                onClick={() => {
                  design({
                    subtype: "root-customize",
                    action: "add",
                    key: component,
                    value: sequence.slice(0, sequence.length - 1),
                  });
                }}
                icon={<MinusOutlined />}
              />
              <Button
                onClick={() => {
                  design({
                    subtype: "root-customize",
                    action: "remove",
                    key: component,
                  });
                }}
                icon={<DeleteOutlined />}
              />
            </Flex>
          </Flex>
        );
      })}
      <Flex justify="center" gap="large">
        <ItemSelect char={newCustomization} onChange={setNew} />
        <Button
          type="primary"
          onClick={() =>
            design({
              subtype: "root-customize",
              action: "add",
              key: newCustomization!,
              value: ["1"],
            })
          }
          disabled={newCustomization === undefined}
        >
          添加自定义
        </Button>
      </Flex>
    </>
  );
};

export default AnalysisCustomizer;
