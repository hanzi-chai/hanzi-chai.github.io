import {
  ModalForm,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import { Button, Form, Space, notification } from "antd";
import type { 运算规则 } from "~/lib";
import { 拼写运算自定义原子, useAddAtom } from "~/atoms";
import { 拼写运算查找表 } from "~/lib";
import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";

interface AlgebraForm {
  name: string;
  rules: 运算规则[];
}

export default function Algebra({
  title,
  initialValues,
  disabled,
}: {
  title: string;
  initialValues?: AlgebraForm;
  disabled?: boolean;
}) {
  const [form] = Form.useForm<AlgebraForm>();
  const addAlgebra = useAddAtom(拼写运算自定义原子);
  return (
    <ModalForm<AlgebraForm>
      title={title}
      trigger={<Button disabled={disabled}>{title}</Button>}
      form={form}
      autoFocusFirstInput
      modalProps={{
        destroyOnClose: true,
        onCancel: () => {},
      }}
      initialValues={initialValues}
      onFinish={async (values) => {
        addAlgebra(values.name, values.rules);
        notification.success({
          message: "提交成功",
        });
        return true;
      }}
    >
      <ProFormText
        width="md"
        name="name"
        label="元素类型名称"
        placeholder="请输入名称"
        rules={[{ required: true }]}
      />
      <Space>
        载入拼写运算预设：
        {Object.entries(拼写运算查找表).map(([name, rules]) => {
          return (
            <Button
              key={name}
              onClick={() => form.setFieldValue("rules", rules)}
            >
              {name}
            </Button>
          );
        })}
      </Space>
      <ProFormList
        name="rules"
        label="拼写运算"
        actionRender={(field, action, defaultActionDom, count) => {
          return [
            ...defaultActionDom,
            <ArrowUpOutlined
              key="up_arrow"
              style={{ marginLeft: "5px" }}
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
              style={{ marginLeft: "5px" }}
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
        <ProFormGroup key="group">
          <ProFormSelect
            name="type"
            label="类别"
            options={[
              { label: "替换 (xform)", value: "xform" },
              { label: "转写 (xlit)", value: "xlit" },
            ]}
          />
          <ProFormText name="from" label="运算输入" />
          <ProFormText name="to" label="运算输出" />
        </ProFormGroup>
      </ProFormList>
    </ModalForm>
  );
}
