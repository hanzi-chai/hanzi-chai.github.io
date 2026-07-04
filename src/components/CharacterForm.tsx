import {
  ArrowDownOutlined,
  ArrowUpOutlined,
} from "@ant-design/icons";
import type { ProFormInstance } from "@ant-design/pro-components";
import {
  ModalForm,
  ProFormCheckbox,
  ProFormDigit,
  ProFormGroup,
  ProFormItem,
  ProFormList,
  ProFormText,
} from "@ant-design/pro-components";
import { Button, Flex, Form, Typography } from "antd";
import type { 字符数据 } from "hanzi-chai";
import type { ReactNode } from "react";
import { useRef } from "react";
import GlyphSelect from "./GlyphSelect";
import SourceSelect from "./SourceSelect";

export default function CharacterForm({
  title,
  initialValues,
  onFinish,
  readonly,
}: {
  title: ReactNode;
  initialValues: 字符数据;
  onFinish: (c: 字符数据) => Promise<boolean>;
  readonly?: boolean;
}) {
  const trigger = <Button>{title}</Button>;
  const formRef = useRef<ProFormInstance>(undefined);
  return (
    <ModalForm<字符数据>
      title={title}
      layout="horizontal"
      omitNil={true}
      trigger={trigger}
      initialValues={initialValues}
      onFinish={onFinish}
      readonly={readonly}
      submitter={readonly ? false : undefined}
      modalProps={{
        width: 1080,
      }}
      formRef={formRef}
    >
      <Flex align="flex-start" gap="large">
        <ProFormDigit name="unicode" label="Unicode" readonly />
        <ProFormDigit name="tygf" label="通用规范" readonly />
        <ProFormDigit name="gb2312" label="GB2312" readonly />
        <ProFormText name="name" label="名称" disabled />
        <ProFormCheckbox name="ambiguous" label="模糊" disabled />
      </Flex>
      <Typography.Title level={5}>字形</Typography.Title>
      <ProFormList
        name="glyphs"
        alwaysShowItemLabel
        actionRender={(field, action, defaultActionDom, count) => {
          return [
            ...defaultActionDom,
            <ArrowUpOutlined
              key="up_arrow"
              className="ml-1"
              onClick={() => {
                if (field.name === 0) {
                  action.move(field.name, count - 1);
                } else {
                  action.move(field.name, field.name - 1);
                }
              }}
            />,
            <ArrowDownOutlined
              key="down_arrow"
              className="ml-1"
              onClick={() => {
                if (field.name === count - 1) {
                  action.move(field.name, 0);
                } else {
                  action.move(field.name, field.name + 1);
                }
              }}
            />,
          ];
        }}
      >
        <ProFormGroup>
          <ProFormItem label="ID" name="id" className="m-0!">
            <GlyphSelect />
          </ProFormItem>
          <ProFormItem name="sources" label="来源">
            <SourceSelect />
          </ProFormItem>
        </ProFormGroup>
      </ProFormList>
    </ModalForm>
  );
}
