import {
  useAtomValue,
  displayAtom,
  useAddAtom,
  customizeAtom,
  useRemoveAtom,
  customizeCornersAtom,
  serializerAtom,
} from "~/atoms";
import { Button, Flex, Form, Popover } from "antd";
import Element from "./Element";
import ElementSelect from "./ElementSelect";
import Char from "./Character";
import {
  ProForm,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import { InlineRender } from "./ComponentForm";
import type { CornerSpecifier } from "~/lib";
import { wordLengthArray, type CompoundAnalysis } from "~/lib";
import { range } from "lodash-es";

const Customize = ({
  component,
  initialValues,
}: {
  component: string;
  initialValues: string[];
}) => {
  const add = useAddAtom(customizeAtom);
  const addCorner = useAddAtom(customizeCornersAtom);
  const serializer = useAtomValue(serializerAtom);
  return (
    <ProForm<{ content: string[]; corners: CornerSpecifier }>
      title={component}
      layout="horizontal"
      initialValues={{ content: initialValues, corners: [0, 0, 0, 0] }}
      onFinish={async ({ content, corners }) => {
        add(component, content);
        if (corners) {
          addCorner(component, corners);
        }
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
      <ProFormGroup>
        {serializer === "c3" &&
          range(4).map((i) => (
            <ProFormSelect
              key={i}
              name={["corners", i]}
              options={wordLengthArray}
            />
          ))}
      </ProFormGroup>
    </ProForm>
  );
};

export default function ResultSummary({
  char,
  analysis,
  disableCustomize = false,
}: {
  char: string;
  analysis: CompoundAnalysis;
  disableCustomize?: boolean;
}) {
  const { sequence, corners } = analysis;
  const display = useAtomValue(displayAtom);
  const customize = useAtomValue(customizeAtom);
  const customizeCorners = useAtomValue(customizeCornersAtom);
  const remove = useRemoveAtom(customizeAtom);
  const removeCorner = useRemoveAtom(customizeCornersAtom);
  const overrideRootSeries = customize[char];
  const overrideCorners = customizeCorners[char];
  const arrows = ["↖", "↗", "↙", "↘"] as const;
  const serializer = useAtomValue(serializerAtom);
  return (
    <Flex gap="middle" justify="space-between">
      <Flex onClick={(e) => e.stopPropagation()} gap="small">
        <Char>{display(char)}</Char>
        {sequence.map((x, index) => {
          return (
            <Flex key={index} align="center">
              <Element>{display(x)}</Element>
              {serializer === "c3" &&
                corners.map((sIndex, cornerType) =>
                  sIndex === index ? (
                    <span key={cornerType + "a"}>{arrows[cornerType]}</span>
                  ) : null,
                )}
            </Flex>
          );
        })}
        {overrideRootSeries && (
          <Flex gap="small" align="center">
            <span>（自定义：）</span>
            {overrideRootSeries.map((x, i) => (
              <Element key={i}>{display(x)}</Element>
            ))}
          </Flex>
        )}
        {overrideCorners && (
          <Flex gap="small" align="center">
            {overrideCorners.map((x, i) => (
              <span key={i}>{x}</span>
            ))}
          </Flex>
        )}
      </Flex>
      {!disableCustomize && (
        <Flex onClick={(e) => e.stopPropagation()} gap="middle">
          {overrideRootSeries && (
            <Button
              onClick={() => {
                remove(char);
                removeCorner(char);
              }}
            >
              取消自定义
            </Button>
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
