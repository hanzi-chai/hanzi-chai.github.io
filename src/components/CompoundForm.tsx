import { AutoComplete, Button, Flex, Form, Typography } from "antd";
import type { Compound } from "~/lib/data";
import { operators } from "~/lib/data";
import { useWatch } from "antd/es/form/Form";
import { GlyphSelect } from "./CharacterSelect";
import {
  ModalForm,
  ProFormDependency,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import { InlineRender, StaticList } from "./ComponentForm";
import { useAtomValue } from "jotai";
import { determinedRepertoireAtom, tagsAtom } from "~/atoms";
import Root from "./Element";
import { EditorColumn, EditorRow } from "./Utils";
import { Box, StrokesView } from "./GlyphView";
import { recursiveRenderCompound } from "~/lib/component";

export const CommonForm = () => {
  const tags = useAtomValue(tagsAtom);
  return (
    <Flex align="flex-start" gap="large">
      <ProFormSelect
        label="类型"
        name="type"
        options={[
          { label: "基本部件", value: "basic_component" },
          { label: "衍生部件", value: "derived_component" },
          { label: "复合体", value: "compound" },
        ]}
        disabled
      />
      <ProFormList
        label="标签"
        name="tags"
        itemRender={InlineRender}
        copyIconProps={false}
        creatorButtonProps={{
          creatorButtonText: "新建",
          icon: false,
          type: "link",
          style: { width: "unset" },
        }}
        creatorRecord={() => "标签"}
      >
        {(meta) => (
          <Form.Item noStyle {...meta}>
            <AutoComplete
              style={{ width: "96px" }}
              options={tags.map((x) => ({ label: x, value: x }))}
            />
          </Form.Item>
        )}
      </ProFormList>
    </Flex>
  );
};

const CompoundForm = ({
  title,
  initialValues,
  onFinish,
  noButton,
  primary,
}: {
  title: string;
  initialValues: Compound;
  onFinish: (c: Compound) => Promise<boolean>;
  noButton?: boolean;
  primary?: boolean;
}) => {
  const repertoire = useAtomValue(determinedRepertoireAtom);
  const [form] = Form.useForm<Compound>();
  const list: string[] = useWatch("operandList", form);
  const trigger = noButton ? (
    <span>{title}</span>
  ) : (
    <Root type={primary ? "primary" : "default"}>{title}</Root>
  );
  return (
    <ModalForm<Compound>
      form={form}
      title={title}
      layout="horizontal"
      trigger={trigger}
      initialValues={initialValues}
      onFinish={onFinish}
      modalProps={{
        width: 1080,
      }}
    >
      <EditorRow>
        <EditorColumn span={8}>
          <Box>
            <ProFormDependency name={["type", "operator", "operandList"]}>
              {(props) => {
                const component = props as Compound;
                const rendered =
                  component?.type !== undefined
                    ? recursiveRenderCompound(component, repertoire)
                    : new Error();
                return (
                  <StrokesView
                    glyph={rendered instanceof Error ? [] : rendered}
                  />
                );
              }}
            </ProFormDependency>
          </Box>
        </EditorColumn>
        <EditorColumn span={16}>
          <CommonForm />
          <Flex gap="0px 8px" wrap="wrap">
            <ProFormSelect
              label="结构"
              name={"operator"}
              onChange={(value) => {
                const newLength = value === "⿲" || value === "⿳" ? 3 : 2;
                const newList = list.concat("一").slice(0, newLength);
                form.setFieldValue("operandList", newList);
              }}
              options={operators.map((x) => ({ value: x, label: x }))}
              style={{ width: "96px" }}
              allowClear={false}
            ></ProFormSelect>
            <StaticList name={"operandList"} itemRender={InlineRender}>
              {(meta, i) => (
                <Form.Item noStyle {...meta}>
                  <GlyphSelect style={{ width: "96px" }} />
                </Form.Item>
              )}
            </StaticList>
          </Flex>
          <ProFormList
            label="笔顺"
            name={"order"}
            copyIconProps={false}
            creatorRecord={{ index: 0, strokes: 0 }}
            creatorButtonProps={{ creatorButtonText: "添加一组笔画" }}
          >
            <ProFormGroup>
              <ProFormSelect
                name="index"
                options={list?.map((_, x) => ({
                  value: x,
                  label: `第 ${x + 1} 部`,
                }))}
                allowClear={false}
              />
              <ProFormSelect
                name="strokes"
                options={[...Array(10).keys()].map((x) => ({
                  value: x,
                  label: x === 0 ? "取剩余全部" : `取 ${x} 笔`,
                }))}
                allowClear={false}
              />
            </ProFormGroup>
          </ProFormList>
        </EditorColumn>
      </EditorRow>
    </ModalForm>
  );
};

export default CompoundForm;
