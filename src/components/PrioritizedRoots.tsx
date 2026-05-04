import { Button, Flex, Space, Typography } from "antd";
import type { 元素 } from "hanzi-chai";
import { useState } from "react";
import {
  useAppendAtom,
  useAtomValue,
  useExcludeAtom,
  分析配置原子,
  弱字根原子,
  强字根原子,
  强类型元素列表原子,
} from "~/atoms";
import ElementSelect from "./ElementSelect";
import { BoxedElementWithTooltip } from "./Utils";

export default function PrioritizedRoots({
  variant,
}: {
  variant: "strong" | "weak";
}) {
  const 字符串列表 = useAtomValue(分析配置原子)[variant] ?? [];
  const 强类型元素列表 = useAtomValue(强类型元素列表原子);
  const 元素列表: 元素[] = [];
  for (const 字符串 of 字符串列表) {
    const 元素 = 强类型元素列表.get(字符串);
    if (元素) 元素列表.push(元素);
  }
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
        {元素列表.map((x, i) => (
          <Space key={x.toString()}>
            <BoxedElementWithTooltip element={x} />
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
