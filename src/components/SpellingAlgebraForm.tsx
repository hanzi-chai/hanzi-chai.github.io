import {
  ModalForm,
  ProFormGroup,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import { Button, Form, notification, Space } from "antd";
import ProFormListMovable from "./ProFormListMovable";
import type { 运算规则 } from "hanzi-chai";
import { 拼写运算查找表 } from "hanzi-chai";
import { useAddAtom, 拼写运算自定义原子 } from "~/atoms";

interface SpellingAlgebraFormProps {
  name: string;
  rules: 运算规则[];
}

export default function SpellingAlgebraForm({
  title,
  initialValues,
  disabled,
}: {
  title: string;
  initialValues?: SpellingAlgebraFormProps;
  disabled?: boolean;
}) {
  const [form] = Form.useForm<SpellingAlgebraFormProps>();
  const addAlgebra = useAddAtom(拼写运算自定义原子);
  return (
    <ModalForm<SpellingAlgebraFormProps>
      title={title}
      trigger={<Button disabled={disabled}>{title}</Button>}
      form={form}
      autoFocusFirstInput
      modalProps={{
        destroyOnHidden: true,
        onCancel: () => {},
      }}
      onOpenChange={(open) => {
        if (open) form.setFieldsValue(initialValues ?? { name: "", rules: [] });
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
      <ProFormListMovable
        name="rules"
        label="拼写运算"
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
      </ProFormListMovable>
    </ModalForm>
  );
}
