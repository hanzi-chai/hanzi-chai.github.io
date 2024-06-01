import { Button } from "antd";
import type { Reading } from "~/lib";
import {
  ModalForm,
  ProFormDigit,
  ProFormGroup,
  ProFormList,
  ProFormText,
} from "@ant-design/pro-components";
import { useAtomValue } from "jotai";
import { repertoireAtom, tagsAtom } from "~/atoms";

export default function ReadingForm({
  title,
  initialValues,
  onFinish,
}: {
  title: string;
  initialValues: Reading[];
  onFinish: (values: { readings: Reading[] }) => Promise<boolean>;
}) {
  const repertoire = useAtomValue(repertoireAtom);
  return (
    <ModalForm<{ readings: Reading[] }>
      title={title}
      trigger={<span>{title}</span>}
      initialValues={{ readings: initialValues }}
      onFinish={onFinish}
    >
      <ProFormList name="readings">
        <ProFormGroup>
          <ProFormText label="拼音" name="pinyin" />
          <ProFormDigit label="权重" name="importance" />
        </ProFormGroup>
      </ProFormList>
    </ModalForm>
  );
}
