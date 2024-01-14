import { ProForm, ProFormSelect } from "@ant-design/pro-form";
import { useAtom } from "jotai";
import { tagsAtom, userTagsAtom } from "~/atoms";

const TagPicker = () => {
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
        label="批量选择字形标签"
        mode="multiple"
        options={tags.map((tag) => ({ label: tag, value: tag }))}
      />
    </ProForm>
  );
};

export default TagPicker;
