import { Form, Space, Button } from "antd";
import { useAtom, 构词配置原子 } from "~/atoms";
import { 多字词长度列表, type 构词规则 } from "~/lib";
import {
  ModalForm,
  ProFormCascader,
  ProFormDependency,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";

const defaultRules: 构词规则[] = [
  { length_equal: 2, formula: "AaAbBaBb" },
  { length_equal: 3, formula: "AaBaCaCb" },
  { length_in_range: [4, 10], formula: "AaBaCaZa" },
];

export default function MultipleRules() {
  const [wordRules, setWordRules] = useAtom(构词配置原子);
  const [form] = Form.useForm<{ rules: 构词规则[] }>();
  const wordLengthArray2D = 多字词长度列表
    .slice(0, 多字词长度列表.length - 1)
    .map((x) => ({
      ...x,
      children: 多字词长度列表.filter((y) => y.value > x.value),
    }));
  const validator = async (_: any, value: string) =>
    /^([A-Z][a-z]){1,}$/.test(value)
      ? Promise.resolve()
      : Promise.reject(new Error("规则格式错误"));
  return (
    <ModalForm<{ rules: 构词规则[] }>
      form={form}
      initialValues={{ rules: wordRules }}
      title="多字词全码"
      trigger={<Button>配置多字词规则</Button>}
      onFinish={async (values) => {
        setWordRules(values.rules);
        return true;
      }}
    >
      <ProFormList name="rules" creatorButtonProps={false}>
        <ProFormGroup>
          <ProFormDependency name={["length_equal", "length_in_range"]}>
            {({ length_equal, length_in_range }) => {
              if (length_equal)
                return (
                  <ProFormSelect
                    name="length_equal"
                    label="长度等于"
                    options={多字词长度列表}
                    width="xs"
                    allowClear={false}
                  />
                );
              if (length_in_range)
                return (
                  <ProFormCascader
                    name="length_in_range"
                    label="长度范围"
                    width="xs"
                    fieldProps={{ options: wordLengthArray2D }}
                    allowClear={false}
                  />
                );
            }}
          </ProFormDependency>
          <ProFormText
            name="formula"
            label="规则"
            allowClear={false}
            rules={[{ validator }]}
          />
        </ProFormGroup>
      </ProFormList>
      <Space>
        <Button
          onClick={() => {
            const newValue = form
              .getFieldValue("rules")
              .concat(defaultRules[0]!);
            form.setFieldValue("rules", newValue);
          }}
        >
          添加规则
        </Button>
        <Button
          onClick={() => {
            const newValue = form
              .getFieldValue("rules")
              .concat(defaultRules[2]!);
            form.setFieldValue("rules", newValue);
          }}
        >
          添加规则（范围）
        </Button>
      </Space>
    </ModalForm>
  );
}
