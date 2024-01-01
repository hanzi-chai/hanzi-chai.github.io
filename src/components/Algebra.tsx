import { PlusOutlined } from "@ant-design/icons";
import {
  ModalForm,
  ProForm,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import { Button, Form, Space, notification } from "antd";
import { CloseCircleOutlined, CopyOutlined } from "@ant-design/icons";
import { Rule } from "~/lib/config";
import { useAtom } from "jotai";
import { algebraAtom, useAddAtom } from "~/atoms";
import { defaultAlgebra } from "~/lib/element";

interface AlgebraForm {
  name: string;
  rules: Rule[];
}

export default function ({
  title,
  initialValues,
  disabled,
}: {
  title: string;
  initialValues?: AlgebraForm;
  disabled?: boolean;
}) {
  const [form] = Form.useForm<AlgebraForm>();
  const [algebra, setAlgebra] = useAtom(algebraAtom);
  const addAlgebra = useAddAtom(algebraAtom);
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
        {Object.entries(defaultAlgebra).map(([name, rules]) => {
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
        copyIconProps={{ Icon: CopyOutlined, tooltipText: "复制此项到末尾" }}
        deleteIconProps={{
          Icon: CloseCircleOutlined,
          tooltipText: "删除这条运算",
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
