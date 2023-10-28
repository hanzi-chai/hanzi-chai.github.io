import { useContext, useState } from "react";
import { ConfigContext, useDesign, useForm } from "./context";
import { Button, Flex } from "antd";
import { ItemSelect, RootSelect, Select } from "./Utils";
import Char from "./Char";

const AnalysisCustomizer = () => {
  const {
    form: {
      analysis: { customize },
    },
  } = useContext(ConfigContext);
  const design = useDesign();
  const form = useForm();
  const [newCustomization, setNew] = useState<string | undefined>(undefined);

  return (
    <>
      {Object.entries(customize).map(([component, sequence]) => {
        return (
          <Flex justify="space-evenly">
            <Char>{form[component].name || component}</Char>
            <Flex gap="small">
              {sequence.map((x, i) => (
                <RootSelect
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
              >
                增加
              </Button>
              <Button
                onClick={() => {
                  design({
                    subtype: "root-customize",
                    action: "add",
                    key: component,
                    value: sequence.slice(0, sequence.length - 1),
                  });
                }}
              >
                减少
              </Button>
            </Flex>
            <Button
              onClick={() => {
                design({
                  subtype: "root-customize",
                  action: "remove",
                  key: component,
                });
              }}
            >
              删除
            </Button>
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
