import { Button, Flex, Space, Typography } from "antd";
import { RootSelect } from "./Utils";
import { useDesign, useFormConfig } from "./context";
import Root from "./Root";
import { useState } from "react";
import { useDisplay } from "./contants";

const PrioritizedRoots = ({ variant }: { variant: "strong" | "weak" }) => {
  const { analysis } = useFormConfig();
  const list = analysis[variant];
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const design = useDesign();
  const display = useDisplay();
  return (
    <>
      <Typography.Title level={4}>
        {variant === "strong" ? "强" : "弱"}字根
      </Typography.Title>
      <Flex wrap="wrap" gap="small">
        {(list ?? []).map((x) => (
          <Space key={x}>
            <Root>{display(x)}</Root>
            <a
              onClick={() =>
                design({
                  subtype: "root-selector-strongweak",
                  variant,
                  action: "remove",
                  value: x,
                })
              }
            >
              删除
            </a>
          </Space>
        ))}
      </Flex>
      <Flex justify="center" gap="large">
        <RootSelect
          char={current}
          onChange={setCurrent}
          exclude=""
          withGrouped
        />
        <Button
          type="primary"
          onClick={() =>
            design({
              subtype: "root-selector-strongweak",
              variant: variant,
              action: "add",
              value: current!,
            })
          }
          disabled={current === undefined}
        >
          添加自定义
        </Button>
      </Flex>
    </>
  );
};

export default PrioritizedRoots;
