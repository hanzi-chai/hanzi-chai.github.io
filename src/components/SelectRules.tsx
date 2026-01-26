import { Button } from "antd";
import { useAtom, useAtomValue } from "jotai";
import { 字母表原子, 编码配置原子 } from "~/atoms";
import { 可打印字符列表, 多字词长度列表, type 编码配置 } from "~/lib";
import {
  ModalForm,
  ProFormGroup,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";

export default function SelectRules() {
  const [encoder, setEncoder] = useAtom(编码配置原子);
  const alphabet = useAtomValue(字母表原子);
  const allowedSelectKeys = 可打印字符列表.filter((x) => !alphabet.includes(x));
  return (
    <ModalForm<编码配置>
      trigger={<Button>配置选择规则</Button>}
      initialValues={encoder}
      onFinish={async (values) => {
        setEncoder({ ...encoder, ...values });
        return true;
      }}
    >
      <ProFormGroup>
        <ProFormSelect
          name="max_length"
          label="最大码长"
          options={多字词长度列表}
        />
        <ProFormSelect
          name="auto_select_length"
          label="顶屏码长"
          options={多字词长度列表}
        />
        <ProFormText name="auto_select_pattern" label="顶屏模式" />
        <ProFormSelect
          label="选择键"
          name="select_keys"
          mode="multiple"
          options={allowedSelectKeys.map((x) => ({ label: x, value: x }))}
        />
      </ProFormGroup>
    </ModalForm>
  );
}
