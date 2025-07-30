import {
  useAtomValue,
  useAddAtom,
  customizeAtom,
  useRemoveAtom,
  dynamicCustomizeAtom,
} from "~/atoms";
import { Button, Flex, Form, Popover } from "antd";
import ElementSelect from "./ElementSelect";
import { ProForm, ProFormList } from "@ant-design/pro-components";
import { InlineRender } from "./ComponentForm";
import type { ComponentAnalysis, CompoundAnalysis } from "~/lib";
import { CharWithTooltip, ElementWithTooltip } from "./ElementPool";
import styled from "styled-components";

const Customize = ({
  component,
  initialValues,
}: {
  component: string;
  initialValues: string[];
}) => {
  const add = useAddAtom(customizeAtom);
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

const MyProFormList = styled(ProFormList)`
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
  const add = useAddAtom(dynamicCustomizeAtom);
  console.log(initialValues);
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
  analysis: ComponentAnalysis | CompoundAnalysis;
  disableCustomize?: boolean;
}) {
  const { sequence } = analysis;
  const customize = useAtomValue(customizeAtom);
  const dynamicCustomize = useAtomValue(dynamicCustomizeAtom);
  const remove = useRemoveAtom(customizeAtom);
  const removeDynamic = useRemoveAtom(dynamicCustomizeAtom);
  const overrideRootSeries = customize[char];
  const overrideDynamicSeries = dynamicCustomize[char];
  return (
    <Flex gap="middle" justify="space-between">
      <Flex onClick={(e) => e.stopPropagation()} gap="small">
        <CharWithTooltip element={char} />
        {sequence.map((x, index) => {
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
            <span>（自定义：）</span>
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
            <Button onClick={() => removeDynamic(char)}>取消动态</Button>
          )}
          {"schemes" in analysis && (
            <Popover
              title="自定义动态拆分"
              trigger="click"
              content={
                <DynamicCustomize
                  component={char}
                  initialValues={
                    dynamicCustomize[char] ??
                    analysis.schemes
                      .filter((x) => x.optional)
                      .map((x) => x.roots)
                  }
                />
              }
            >
              <Button>动态</Button>
            </Popover>
          )}
          <Popover
            title="自定义拆分"
            content={
              <Customize
                component={char}
                initialValues={overrideRootSeries ?? sequence}
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
