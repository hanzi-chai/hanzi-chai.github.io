import { ProForm, ProFormList } from "@ant-design/pro-components";
import { Button, Flex, Form, Popover } from "antd";
import styled from "styled-components";
import {
  useAddAtom,
  useAtomValue,
  useRemoveAtom,
  动态分析原子,
  动态自定义拆分原子,
  原始字库原子,
  自定义拆分原子,
} from "~/atoms";
import {
  type 基本分析,
  type 复合体,
  部件,
  type 默认部件分析,
} from "hanzi-chai";
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
            <ElementSelect style={{ width: 96 }} onlyRootsAndStrokes />
          </Form.Item>
        )}
      </ProFormList>
    </ProForm>
  );
};

export const MyProFormList = styled(ProFormList)`
  & .ant-pro-form-list-action {
    margin: 0;
  }

  & .ant-pro-form-list > .ant-form-item {
    margin-bottom: 4px;
  }
`;

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
                style={{ width: 96 }}
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
  const customize = useAtomValue(自定义拆分原子);
  const remove = useRemoveAtom(自定义拆分原子);
  const dynamic = useAtomValue(动态分析原子);
  const dynamicCustomize = useAtomValue(动态自定义拆分原子);
  const removeDynamic = useRemoveAtom(动态自定义拆分原子);
  const 索引 = glyph instanceof 部件 ? glyph.获取索引() : "";
  const overrideRootSeries = customize[索引];
  const overrideDynamicSeries = dynamicCustomize[索引];
  const 原始字库 = useAtomValue(原始字库原子);
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
        {overrideRootSeries && (
          <Flex gap="small" align="center">
            <span>（自定义：）</span>
            {overrideRootSeries.map((x, i) => {
              const 字符 = 原始字库.校验(x)?.character;
              return <BoxedElementWithTooltip key={i} element={字符 ?? x} />;
            })}
          </Flex>
        )}
        {overrideDynamicSeries && (
          <Flex gap="small" align="center" wrap="wrap">
            <span>（自定义组：）</span>
            {overrideDynamicSeries.map((x, i) => (
              <Flex key={i} align="center">
                {x.map((y, j) => {
                  const 字符 = 原始字库.校验(y)?.character;
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
          {overrideRootSeries && (
            <Button onClick={() => remove(索引)}>取消自定义</Button>
          )}
          {overrideDynamicSeries && (
            <Button onClick={() => removeDynamic(索引)}>取消自定义组</Button>
          )}
          {"全部拆分方式" in analysis && dynamic && (
            <Popover
              title="自定义动态拆分"
              trigger="click"
              content={
                <DynamicCustomize
                  component={glyph}
                  initialValues={
                    dynamicCustomize[索引] ??
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
            content={
              <Customize
                component={glyph}
                initialValues={
                  overrideRootSeries ?? 字根序列.map((x) => x.获取名称())
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
