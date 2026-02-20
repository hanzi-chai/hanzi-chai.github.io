import { ProForm, ProFormList } from "@ant-design/pro-components";
import { Button, Flex, Form, Popover } from "antd";
import styled from "styled-components";
import {
  useAddAtom,
  useAtomValue,
  useRemoveAtom,
  动态分析原子,
  动态自定义拆分原子,
  自定义拆分原子,
} from "~/atoms";
import type { 基本分析, 默认部件分析 } from "~/lib";
import { InlineRender } from "./ComponentForm";
import { CharWithTooltip, ElementWithTooltip } from "./ElementPool";
import ElementSelect from "./ElementSelect";

const Customize = ({
  component,
  initialValues,
}: {
  component: string;
  initialValues: string[];
}) => {
  const add = useAddAtom(自定义拆分原子);
  return (
    <ProForm<{ content: string[] }>
      title={component}
      layout="horizontal"
      initialValues={{ content: initialValues }}
      onFinish={async ({ content }) => {
        add(component, content);
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
  component: string;
  initialValues: string[][];
}) => {
  const add = useAddAtom(动态自定义拆分原子);
  return (
    <ProForm<{ content: { content: string[] }[] }>
      title={component}
      layout="horizontal"
      initialValues={{
        content: initialValues.map((x) => ({ content: x })),
      }}
      onFinish={async ({ content }) => {
        add(
          component,
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
  char,
  analysis,
  disableCustomize = false,
}: {
  char: string;
  analysis: 基本分析 | 默认部件分析;
  disableCustomize?: boolean;
}) {
  let 字根序列 = analysis.字根序列;
  if ("被覆盖拆分方式" in analysis && analysis.被覆盖拆分方式) {
    字根序列 = analysis.被覆盖拆分方式.拆分方式.map((x) => x.名称);
  }
  const customize = useAtomValue(自定义拆分原子);
  const remove = useRemoveAtom(自定义拆分原子);
  const dynamic = useAtomValue(动态分析原子);
  const dynamicCustomize = useAtomValue(动态自定义拆分原子);
  const removeDynamic = useRemoveAtom(动态自定义拆分原子);
  const overrideRootSeries = customize[char];
  const overrideDynamicSeries = dynamicCustomize[char];
  return (
    <Flex gap="middle" justify="space-between">
      <Flex onClick={(e) => e.stopPropagation()} gap="small">
        <CharWithTooltip element={char} />
        {字根序列.map((x, index) => {
          return (
            <Flex key={index} align="center">
              <ElementWithTooltip element={x} />
            </Flex>
          );
        })}
        {overrideRootSeries && (
          <Flex gap="small" align="center">
            <span>（自定义：）</span>
            {overrideRootSeries.map((x, i) => (
              <ElementWithTooltip key={i} element={x} />
            ))}
          </Flex>
        )}
        {overrideDynamicSeries && (
          <Flex gap="small" align="center" wrap="wrap">
            <span>（自定义组：）</span>
            {overrideDynamicSeries.map((x, i) => (
              <Flex key={i} align="center">
                {x.map((y, j) => (
                  <ElementWithTooltip key={j} element={y} />
                ))}
                ・
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
      {!disableCustomize && (
        <Flex onClick={(e) => e.stopPropagation()} gap="middle">
          {overrideRootSeries && (
            <Button onClick={() => remove(char)}>取消自定义</Button>
          )}
          {overrideDynamicSeries && (
            <Button onClick={() => removeDynamic(char)}>取消自定义组</Button>
          )}
          {"全部拆分方式" in analysis && dynamic && (
            <Popover
              title="自定义动态拆分"
              trigger="click"
              content={
                <DynamicCustomize
                  component={char}
                  initialValues={
                    dynamicCustomize[char] ??
                    analysis.全部拆分方式
                      .filter((x) => x.可用)
                      .map((x) => x.拆分方式.map((y) => y.名称))
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
                component={char}
                initialValues={overrideRootSeries ?? 字根序列}
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
