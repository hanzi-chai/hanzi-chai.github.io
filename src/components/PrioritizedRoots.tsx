import { Button, Flex, Space, Typography } from "antd";
import {
  useAtomValue,
  analysisAtom,
  displayAtom,
  useExcludeAtom,
  strongAtom,
  useAppendAtom,
  weakAtom,
} from "~/atoms";
import Element from "./Element";
import { useState } from "react";
import ElementSelect from "./ElementSelect";

export default function PrioritizedRoots({
  variant,
}: {
  variant: "strong" | "weak";
}) {
  const analysis = useAtomValue(analysisAtom);
  const list = analysis ? analysis[variant] : [];
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const atom = variant === "strong" ? strongAtom : weakAtom;
  const display = useAtomValue(displayAtom);
  const exclude = useExcludeAtom(atom);
  const append = useAppendAtom(atom);
  return (
    <>
      <Typography.Title level={4}>
        {variant === "strong" ? "强" : "弱"}字根
      </Typography.Title>
      <Flex wrap="wrap" gap="small">
        {(list ?? []).map((x, i) => (
          <Space key={x}>
            <Element>{display(x)}</Element>
            <a onClick={() => exclude(i)}>删除</a>
          </Space>
        ))}
      </Flex>
      <Flex justify="center" gap="large">
        <ElementSelect
          value={current}
          onChange={setCurrent}
          onlyRootsAndStrokes
        />
        <Button
          type="primary"
          onClick={() => append(current!)}
          disabled={current === undefined}
        >
          添加自定义
        </Button>
      </Flex>
    </>
  );
}
