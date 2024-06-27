import { Form, Space, Button } from "antd";
import { useAtom, wordRulesAtom } from "~/atoms";
import type { WordRule } from "~/lib";
import { wordLengthArray } from "~/lib";
import {
  ModalForm,
  ProFormCascader,
  ProFormDependency,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";

const defaultRules: WordRule[] = [
  { length_equal: 2, formula: "AaAbBaBb" },
  { length_equal: 3, formula: "AaBaCaCb" },
  { length_in_range: [4, 10], formula: "AaBaCaZa" },
];

export default function MultipleRules() {
  const [wordRules, setWordRules] = useAtom(wordRulesAtom);
  const [form] = Form.useForm<{ rules: WordRule[] }>();
  const wordLengthArray2D = wordLengthArray
    .slice(0, wordLengthArray.length - 1)
    .map((x) => ({
      ...x,
      children: wordLengthArray.filter((y) => y.value > x.value),
    }));
  const validator = async (_: any, value: string) =>
    /^([A-Z][a-z]){1,}$/.test(value)
      ? Promise.resolve()
      : Promise.reject(new Error("规则格式错误"));
  return (
    <ModalForm<{ rules: WordRule[] }>
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
                    options={wordLengthArray}
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
