import { ProForm, ProFormSelect } from "@ant-design/pro-form";
import { useAtom } from "jotai";
import { forwardRef } from "react";
import { tagsAtom, userTagsAtom } from "~/atoms";

const TagPicker = forwardRef((_, ref) => {
  const [tags] = useAtom(tagsAtom);
  const [userTags, setUserTags] = useAtom(userTagsAtom);

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
