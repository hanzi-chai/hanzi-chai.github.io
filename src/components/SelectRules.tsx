import { Button } from "antd";
import { useAtom, useAtomValue } from "jotai";
import { alphabetAtom, encoderAtom } from "~/atoms";
import type { EncoderConfig } from "~/lib";
import { printableAscii, wordLengthArray } from "~/lib";
import {
  ModalForm,
  ProFormGroup,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";

export default function SelectRules() {
  const [encoder, setEncoder] = useAtom(encoderAtom);
  const alphabet = useAtomValue(alphabetAtom);
  const allowedSelectKeys = printableAscii.filter((x) => !alphabet.includes(x));
  return (
    <ModalForm<EncoderConfig>
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
          options={wordLengthArray}
        />
        <ProFormSelect
          name="auto_select_length"
          label="顶屏码长"
          options={wordLengthArray}
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
