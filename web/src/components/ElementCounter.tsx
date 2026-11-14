import { Col, Row, Statistic, Typography } from "antd";
import {
  二笔,
  type 元素,
  拼音元素,
  是强类型归并,
  笔画,
  结构符元素,
  自定义元素,
} from "hanzi-chai";
import { useAtomValueUnwrapped, 强类型决策原子 } from "~/atoms";

interface Count {
  笔画: number;
  二笔: number;
  字根: number;
  结构: number;
  拼音: number;
}

function categorizeElement(element: 元素): keyof Count {
  if (element instanceof 笔画) return "笔画";
  if (element instanceof 二笔) return "二笔";
  if (element instanceof 结构符元素) return "结构";
  if (element instanceof 拼音元素 || element instanceof 自定义元素)
    return "拼音";
  return "字根";
}

function countElements(elements: 元素[]): Count {
  const count: Count = { 笔画: 0, 二笔: 0, 字根: 0, 结构: 0, 拼音: 0 };
  for (const element of elements) {
    count[categorizeElement(element)]++;
  }
  return count;
}

const ElementSubCounter = ({
  title,
  count,
}: {
  title: string;
  count: Count;
}) => {
  return (
    <>
      <Typography.Title level={3}>{title}</Typography.Title>
      <Row gutter={16} className="justify-center">
        {Object.entries(count).map(([key, value]) =>
          value ? (
            <Col key={key}>
              <Statistic title={key} value={value} />
            </Col>
          ) : null,
        )}
      </Row>
    </>
  );
};

export default function ElementCounter() {
  const mapping = useAtomValueUnwrapped(强类型决策原子);
  const allElements = [...mapping.keys()];
  const mainElements = allElements.filter(
    (e) => !是强类型归并(mapping.get(e)!),
  );
  return (
    <>
      <ElementSubCounter title="主要元素" count={countElements(mainElements)} />
      <ElementSubCounter title="全部元素" count={countElements(allElements)} />
    </>
  );
}
