import { Button, Flex, Form } from "antd";
import type { ShortCodeRule } from "~/lib";
import { wordLengthArray } from "~/lib";
import { useAtom } from "~/atoms";
import { shortCodeConfigAtom } from "~/atoms";
import {
  ModalForm,
  ProFormCascader,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
} from "@ant-design/pro-components";

const defaultRules: ShortCodeRule[] = [
  {
    length_equal: 1,
    schemes: [
      { prefix: 1, count: 1 },
      { prefix: 2, count: 1 },
      { prefix: 3, count: 1 },
    ],
  },
  {
    length_in_range: [2, 4],
    schemes: [{ prefix: 2, count: 1 }],
  },
];

export default function ShortCodeRules() {
  const [shortCodeConfig, setShortCodeConfig] = useAtom(shortCodeConfigAtom);
  const wordLengthArray2D = wordLengthArray
    .slice(0, wordLengthArray.length - 1)
    .map((x) => ({
      ...x,
      children: wordLengthArray.filter((y) => y.value > x.value),
    }));
  const [form] = Form.useForm<{ short_code: ShortCodeRule[] }>();
  return (
    <ModalForm
      layout="horizontal"
      trigger={<Button>配置简码规则</Button>}
      initialValues={{ short_code: shortCodeConfig }}
      onFinish={async (values) => {
        setShortCodeConfig(values.short_code);
        return true;
      }}
      form={form}
    >
      <ProFormList
        name="short_code"
        creatorButtonProps={false}
        alwaysShowItemLabel
      >
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
        <ProFormList name="schemes" alwaysShowItemLabel>
          <ProFormGroup>
            <ProFormDigit name="prefix" label="前缀" width="xs" />
            <ProFormDigit name="count" label="数量" width="xs" />
          </ProFormGroup>
        </ProFormList>
      </ProFormList>
      <Flex justify="center" gap="middle">
        <Button
          onClick={() => {
            const newValue = form
              .getFieldValue("short_code")
              .concat(defaultRules[0]!);
            form.setFieldValue("short_code", newValue);
          }}
        >
          添加规则
        </Button>
        <Button
          onClick={() => {
            const newValue = form
              .getFieldValue("short_code")
              .concat(defaultRules[1]!);
            form.setFieldValue("short_code", newValue);
          }}
        >
          添加规则（范围）
        </Button>
      </Flex>
    </ModalForm>
  );
}
