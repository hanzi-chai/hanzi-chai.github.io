import { Button, Flex, Space, Typography } from "antd";
import { useState } from "react";
import {
  useAppendAtom,
  useAtomValue,
  useExcludeAtom,
  分析配置原子,
  弱字根原子,
  强字根原子,
} from "~/atoms";
import Element from "./BorderItem";
import ElementSelect from "./ElementSelect";
import { ConvertDisplay } from "./Mapping";
import { Display } from "./Utils";

export default function PrioritizedRoots({
  variant,
}: {
  variant: "strong" | "weak";
}) {
  const analysis = useAtomValue(分析配置原子);
  const list = analysis ? analysis[variant] : [];
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const atom = variant === "strong" ? 强字根原子 : 弱字根原子;
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
            <Element>
              <ConvertDisplay name={x} />
            </Element>
            <Button variant="text" color="danger" onClick={() => exclude(i)}>
              删除
            </Button>
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
