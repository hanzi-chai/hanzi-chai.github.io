import { AutoComplete, Button, Flex, Form, Typography } from "antd";
import type { Compound } from "~/lib/data";
import { operators } from "~/lib/data";
import { useWatch } from "antd/es/form/Form";
import { GlyphSelect } from "./CharacterSelect";
import {
  ModalForm,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";
import { InlineRender, StaticList } from "./ComponentForm";
import { useAtomValue } from "jotai";
import { tagsAtom } from "~/atoms";
import { DeleteButton } from "./Utils";
import Root from "./Root";

export const CommonForm = () => {
  const tags = useAtomValue(tagsAtom);
  return (
    <Flex align="flex-start" gap="large">
      <ProFormSelect
        label="类型"
        name={["type"]}
        options={[
          { label: "部件", value: "component" },
          { label: "复合体", value: "compound" },
        ]}
        disabled
      />
      <ProFormList
        label="标签"
        name={["tags"]}
        itemRender={InlineRender}
        copyIconProps={false}
        creatorRecord={() => ({ toString: () => "形声" })}
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
      <div style={{ flex: 1 }} />
      <DeleteButton onClick={() => {}} />
    </Flex>
  );
};

const CompoundForm = ({
  title,
  initialValues,
  onFinish,
  noButton,
}: {
  title: string;
  initialValues: Compound;
  onFinish: (c: Compound) => Promise<boolean>;
  noButton?: boolean;
}) => {
  const [form] = Form.useForm<Compound>();
  const list: string[] = useWatch("operandList", form);
  const trigger = noButton ? <span>{title}</span> : <Root>{title}</Root>;
  return (
    <ModalForm<Compound>
      title={title}
      layout="horizontal"
      trigger={trigger}
      initialValues={initialValues}
      onFinish={onFinish}
    >
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
      >
        <ProFormGroup>
          <ProFormSelect
            name="index"
            options={list?.map((_, x) => ({
              value: x,
              label: `第 ${x + 1} 部`,
            }))}
          />
          <ProFormSelect
            name="strokes"
            options={[...Array(10).keys()].map((x) => ({
              value: x,
              label: x === 0 ? "取剩余全部" : `取 ${x} 笔`,
            }))}
          />
        </ProFormGroup>
      </ProFormList>
    </ModalForm>
  );
};

export default CompoundForm;
