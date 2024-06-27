import {
  useAtomValue,
  displayAtom,
  useAddAtom,
  customizeAtom,
  useRemoveAtom,
} from "~/atoms";
import { Button, Flex, Form, Popover, Space } from "antd";
import Element from "./Element";
import ElementSelect from "./ElementSelect";
import Char from "./Character";
import { ProForm, ProFormList } from "@ant-design/pro-components";
import { InlineRender } from "./ComponentForm";

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

export default function ResultSummary({
  char,
  rootSeries,
  disableCustomize = false,
}: {
  char: string;
  rootSeries: string[];
  disableCustomize?: boolean;
}) {
  const display = useAtomValue(displayAtom);
  const customize = useAtomValue(customizeAtom);
  const remove = useRemoveAtom(customizeAtom);
  const overrideRootSeries = customize[char];
  return (
    <Flex gap="middle" justify="space-between">
      <Space onClick={(e) => e.stopPropagation()}>
        <Char>{display(char)}</Char>
        {rootSeries.map((x, index) => (
          <Element key={index}>{display(x)}</Element>
        ))}
        {overrideRootSeries && (
          <Flex gap="small" align="center">
            <span>（自定义：）</span>
            {overrideRootSeries.map((x, i) => (
              <Element key={i}>{display(x)}</Element>
            ))}
          </Flex>
        )}
      </Space>
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
                initialValues={overrideRootSeries ?? rootSeries}
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
