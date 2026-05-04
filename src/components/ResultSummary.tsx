import { ProForm, ProFormList } from "@ant-design/pro-components";
import { Button, Flex, Form, Popover } from "antd";
import {
  type 基本分析,
  type 复合体,
  未知元素,
  部件,
  type 默认部件分析,
} from "hanzi-chai";
import type { ComponentProps } from "react";
import {
  useAddAtom,
  useAtomValue,
  useRemoveAtom,
  动态分析原子,
  动态自定义拆分原子,
  强类型元素列表原子,
  自定义拆分原子,
} from "~/atoms";
import { InlineRender } from "./ComponentForm";
import ElementSelect from "./ElementSelect";
import { BoxedElementWithTooltip, CharacterWithTooltip } from "./Utils";

const Customize = ({
  component,
  initialValues,
}: {
  component: 部件;
  initialValues: string[];
}) => {
  const add = useAddAtom(自定义拆分原子);
  const 索引 = component.获取索引();
  return (
    <ProForm<{ content: string[] }>
      title={component.获取名称()}
      layout="horizontal"
      initialValues={{ content: initialValues }}
      onFinish={async ({ content }) => {
        add(索引, content);
        return true;
      }}
    >
      <ProFormList
        name="content"
        creatorButtonProps={{
          creatorButtonText: "添加",
          icon: false,
          style: { width: "unset" },
        }}
        itemRender={InlineRender}
        creatorRecord={() => "1"}
        copyIconProps={false}
      >
        {(meta) => (
          <Form.Item noStyle {...meta}>
            <ElementSelect className="w-24" onlyRootsAndStrokes />
          </Form.Item>
        )}
      </ProFormList>
    </ProForm>
  );
};

export const MyProFormList = (props: ComponentProps<typeof ProFormList>) => (
  <ProFormList
    className={`result-summary-list ${props.className ?? ""}`}
    {...props}
  />
);

const DynamicCustomize = ({
  component,
  initialValues,
}: {
  component: 部件;
  initialValues: string[][];
}) => {
  const add = useAddAtom(动态自定义拆分原子);
  const 索引 = component.获取索引();
  return (
    <ProForm<{ content: { content: string[] }[] }>
      title={component.获取名称()}
      layout="horizontal"
      initialValues={{
        content: initialValues.map((x) => ({ content: x })),
      }}
      onFinish={async ({ content }) => {
        add(
          索引,
          content.map((x) => x.content),
        );
        return true;
      }}
    >
      <MyProFormList name="content">
        <MyProFormList
          name="content"
          creatorButtonProps={{
            creatorButtonText: "添加",
            icon: false,
            style: { width: "unset" },
          }}
          itemRender={InlineRender}
          creatorRecord={() => "1"}
          copyIconProps={false}
        >
          {(meta) => (
            <Form.Item noStyle {...meta}>
              <ElementSelect
                className="w-24"
                onlyRootsAndStrokes
                includeOptional
              />
            </Form.Item>
          )}
        </MyProFormList>
      </MyProFormList>
    </ProForm>
  );
};

export default function ResultSummary({
  glyph,
  analysis,
}: {
  glyph: 部件 | 复合体;
  analysis: 基本分析 | 默认部件分析;
}) {
  let 字根序列 = analysis.字根序列;
  if ("被覆盖拆分方式" in analysis && analysis.被覆盖拆分方式) {
    字根序列 = analysis.被覆盖拆分方式.拆分方式.map((x) => x.字根);
  }
  const 是否动态分析 = useAtomValue(动态分析原子);
  const 自定义分析 = useAtomValue(自定义拆分原子);
  const 移除自定义分析 = useRemoveAtom(自定义拆分原子);
  const 动态自定义分析 = useAtomValue(动态自定义拆分原子);
  const 移除动态自定义分析 = useRemoveAtom(动态自定义拆分原子);
  const 索引 = glyph instanceof 部件 ? glyph.获取索引() : "";
  const 自定义字根序列 = 自定义分析[索引];
  const 自定义字根序列列表 = 动态自定义分析[索引];
  const 强类型元素列表 = useAtomValue(强类型元素列表原子);
  return (
    <Flex gap="middle" justify="space-between">
      <Flex onClick={(e) => e.stopPropagation()} gap="small">
        <CharacterWithTooltip element={glyph.字符} />
        {字根序列.map((x, index) => {
          const element = x instanceof 部件 ? x.字符 : x;
          return (
            <Flex key={index} align="center">
              <BoxedElementWithTooltip element={element} />
            </Flex>
          );
        })}
        {自定义字根序列 && (
          <Flex gap="small" align="center">
            <span>（自定义：）</span>
            {自定义字根序列.map((x, i) => {
              const 字符 = 强类型元素列表.get(x) ?? new 未知元素(x);
              return <BoxedElementWithTooltip key={i} element={字符 ?? x} />;
            })}
          </Flex>
        )}
        {自定义字根序列列表 && (
          <Flex gap="small" align="center" wrap="wrap">
            <span>（自定义组：）</span>
            {自定义字根序列列表.map((x, i) => (
              <Flex key={i} align="center">
                {x.map((y, j) => {
                  const 字符 = 强类型元素列表.get(y) ?? new 未知元素(y);
                  return (
                    <BoxedElementWithTooltip key={j} element={字符 ?? y} />
                  );
                })}
                ・
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
      {glyph instanceof 部件 && (
        <Flex onClick={(e) => e.stopPropagation()} gap="middle">
          {自定义字根序列 && (
            <Button onClick={() => 移除自定义分析(索引)}>取消自定义</Button>
          )}
          {自定义字根序列列表 && (
            <Button onClick={() => 移除动态自定义分析(索引)}>
              取消自定义组
            </Button>
          )}
          {"全部拆分方式" in analysis && 是否动态分析 && (
            <Popover
              title="自定义动态拆分"
              trigger="click"
              content={
                <DynamicCustomize
                  component={glyph}
                  initialValues={
                    动态自定义分析[索引] ??
                    analysis.全部拆分方式
                      .filter((x) => x.可用)
                      .map((x) => x.拆分方式.map((y) => y.字根.获取名称()))
                  }
                />
              }
            >
              <Button>自定义组</Button>
            </Popover>
          )}
          <Popover
            title="自定义拆分"
            trigger="click"
            content={
              <Customize
                component={glyph}
                initialValues={
                  自定义字根序列 ?? 字根序列.map((x) => x.获取名称())
                }
              />
            }
          >
            <Button>自定义</Button>
          </Popover>
        </Flex>
      )}
    </Flex>
  );
}
