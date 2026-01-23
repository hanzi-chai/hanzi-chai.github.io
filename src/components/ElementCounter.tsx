import { Col, Row, Statistic, Typography } from "antd";
import { useAtomValue } from "jotai";
import { 决策原子 } from "~/atoms";
import { 是归并 } from "~/lib";

interface Count {
  笔画: number;
  二笔: number;
  字根: number;
  结构: number;
  拼音: number;
}

function countElementByCategory(elements: string[]): Count {
  const count: Count = {
    笔画: 0,
    二笔: 0,
    字根: 0,
    结构: 0,
    拼音: 0,
  };
  for (const element of elements) {
    if (/^\d$/.test(element)) {
      count.笔画++;
    } else if (/^\d\d$/.test(element)) {
      count.二笔++;
    } else if (/^[\u2FF0-\u2FFF]$/.test(element)) {
      count.结构++;
    } else if (/^.$/.test(element)) {
      count.字根++;
    } else {
      count.拼音++;
    }
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
      <Row gutter={16} style={{ justifyContent: "center" }}>
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
  const mapping = useAtomValue(决策原子);
  const elements = Object.keys(mapping);
  const mainElements: string[] = [];
  for (const [element, value] of Object.entries(mapping)) {
    if (!是归并(value)) mainElements.push(element);
  }
  const mainCount = countElementByCategory(mainElements);
  const count = countElementByCategory(elements);
  return (
    <>
      <ElementSubCounter title="主要元素" count={mainCount} />
      <ElementSubCounter title="全部元素" count={count} />
    </>
  );
}
