import { Button, Flex, Form } from "antd";
import type { Compound } from "~/lib";
import { operators } from "~/lib";
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
import { repertoireAtom, tagsAtom } from "~/atoms";
import Element from "./Element";
import { EditorColumn, EditorRow } from "./Utils";
import { Box, StrokesView } from "./GlyphView";
import { recursiveRenderCompound } from "~/lib";

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
      <ProFormSelect
        label="标签"
        name="tags"
        mode="tags"
        options={tags.map((x) => ({ label: x, value: x }))}
      />
    </Flex>
  );
};

export default function CompoundForm({
  title,
  initialValues,
  onFinish,
  noButton,
  primary,
  readonly,
}: {
  title: string;
  initialValues: Compound;
  onFinish: (c: Compound) => Promise<boolean>;
  noButton?: boolean;
  primary?: boolean;
  readonly?: boolean;
}) {
  const repertoire = useAtomValue(repertoireAtom);
  const [form] = Form.useForm<Compound>();
  const list: string[] = useWatch("operandList", form);
  const trigger = noButton ? (
    <span>{title}</span>
  ) : (
    <Element type={primary ? "default" : "text"}>{title}</Element>
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
      readonly={readonly}
      submitter={readonly ? false : undefined}
    >
      <EditorRow>
        <EditorColumn span={10}>
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
                    displayMode
                    glyph={rendered instanceof Error ? [] : rendered}
                  />
                );
              }}
            </ProFormDependency>
          </Box>
        </EditorColumn>
        <EditorColumn span={14}>
          <CommonForm />
          <Flex gap="0px 8px" wrap="wrap">
            <ProFormSelect
              label="结构"
              name="operator"
              onChange={(value) => {
                const newLength = value === "⿲" || value === "⿳" ? 3 : 2;
                const newList = list.concat("一").slice(0, newLength);
                form.setFieldValue("operandList", newList);
              }}
              options={operators.map((x) => ({ value: x, label: x }))}
              style={{ width: "96px" }}
              allowClear={false}
            />
            <StaticList name="operandList" itemRender={InlineRender}>
              {(meta) => (
                <Form.Item noStyle {...meta}>
                  <GlyphSelect style={{ width: "96px" }} disabled={readonly} />
                </Form.Item>
              )}
            </StaticList>
          </Flex>
          <ProFormList
            label="笔顺"
            name="order"
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
                options={[...Array(12).keys()].map((x) => ({
                  value: x,
                  label: x === 0 ? "取剩余全部" : `取 ${x} 笔`,
                }))}
                allowClear={false}
              />
            </ProFormGroup>
          </ProFormList>
          <ProFormGroup>
            <Button
              onClick={() => {
                form.setFieldValue("order", undefined);
              }}
            >
              清空笔顺
            </Button>
          </ProFormGroup>
        </EditorColumn>
      </EditorRow>
    </ModalForm>
  );
}
