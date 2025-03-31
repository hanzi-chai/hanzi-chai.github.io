import {
  useAtomValue,
  useAddAtom,
  customizeAtom,
  useRemoveAtom,
  serializerAtom,
} from "~/atoms";
import { Button, Flex, Form, Popover } from "antd";
import ElementSelect from "./ElementSelect";
import {
  ProForm,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import { InlineRender } from "./ComponentForm";
import type { CommonAnalysis, CornerSpecifier } from "~/lib";
import { wordLengthArray } from "~/lib";
import { range } from "lodash-es";
import { CharWithTooltip, ElementWithTooltip } from "./ElementPool";

const Customize = ({
  component,
  initialValues,
}: {
  component: string;
  initialValues: string[];
}) => {
  const add = useAddAtom(customizeAtom);
  return (
    <ProForm<{ content: string[]; corners: CornerSpecifier }>
      title={component}
      layout="horizontal"
      initialValues={{ content: initialValues, corners: [0, 0, 0, 0] }}
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

export default function ResultSummary({
  char,
  analysis,
  disableCustomize = false,
}: {
  char: string;
  analysis: CommonAnalysis;
  disableCustomize?: boolean;
}) {
  const { sequence } = analysis;
  const customize = useAtomValue(customizeAtom);
  const remove = useRemoveAtom(customizeAtom);
  const overrideRootSeries = customize[char];
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
      </Flex>
      {!disableCustomize && (
        <Flex onClick={(e) => e.stopPropagation()} gap="middle">
          {overrideRootSeries && (
            <Button onClick={() => remove(char)}>取消自定义</Button>
          )}
          <Popover
            title=""
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
