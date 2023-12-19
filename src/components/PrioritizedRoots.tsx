import { Button, Flex, Space, Typography } from "antd";
import { RootSelect } from "./Utils";
import {
  useAtomValue,
  useSetAtom,
  configAnalysisAtom,
  useDisplay,
  removeRootSelectorStrongWeakAtom,
  addRootSelectorStrongWeakAtom,
} from "~/atoms";
import Root from "./Root";
import { useState } from "react";

const PrioritizedRoots = ({ variant }: { variant: "strong" | "weak" }) => {
  const analysis = useAtomValue(configAnalysisAtom);
  const list = analysis ? analysis[variant] : [];
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const display = useDisplay();
  const removeRootSelectorStrongWeak = useSetAtom(
    removeRootSelectorStrongWeakAtom,
  );
  const addRootSelectorStrongWeak = useSetAtom(addRootSelectorStrongWeakAtom);
  return (
    <>
      <Typography.Title level={4}>
        {variant === "strong" ? "强" : "弱"}字根
      </Typography.Title>
      <Flex wrap="wrap" gap="small">
        {(list ?? []).map((x) => (
          <Space key={x}>
            <Root>{display(x)}</Root>
            <a onClick={() => removeRootSelectorStrongWeak(variant, x)}>删除</a>
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
          onClick={() => addRootSelectorStrongWeak(variant, current!)}
          disabled={current === undefined}
        >
          添加自定义
        </Button>
      </Flex>
    </>
  );
};

export default PrioritizedRoots;
