import { ProForm, ProFormSelect } from "@ant-design/pro-form";
import { useAtom } from "jotai";
import { forwardRef } from "react";
import { 全部标签原子, 用户标签列表原子 } from "~/atoms";

const TagPicker = forwardRef(() => {
  const [tags] = useAtom(全部标签原子);
  const [userTags, setUserTags] = useAtom(用户标签列表原子);

  const handleFormSubmit = (values: { tags: string[] }) => {
    setUserTags(values.tags);
  };

  return (
    <ProForm
      initialValues={{ tags: userTags }}
      onValuesChange={handleFormSubmit}
      layout="horizontal"
      submitter={false}
    >
      <ProFormSelect
        name="tags"
        label="通过标签来批量选择字形"
        mode="multiple"
        options={tags.map((tag) => ({ label: tag, value: tag }))}
      />
    </ProForm>
  );
});

export default TagPicker;
