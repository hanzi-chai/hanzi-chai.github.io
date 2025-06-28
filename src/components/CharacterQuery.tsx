import { Form } from "antd";
import type { CharacterFilter } from "~/lib";
import { operators } from "~/lib";
import {
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  QueryFilter,
} from "@ant-design/pro-components";
import { useAtomValue } from "jotai";
import { tagsAtom } from "~/atoms";
import CharacterSelect from "./CharacterSelect";
import { debounce } from "lodash-es";

interface StrokeSearchProps {
  setFilter: (s: CharacterFilter) => void;
}

export default function CharacterQuery({ setFilter }: StrokeSearchProps) {
  const tags = useAtomValue(tagsAtom);
  const debounced = debounce(setFilter, 500);
  return (
    <QueryFilter<CharacterFilter>
      onValuesChange={async (_, values) => debounced(values)}
      submitter={false}
      style={{ maxWidth: 1080 }}
      autoFocusFirstInput={false}
    >
      <ProFormDigit label="Unicode" name="unicode" />
      <ProFormText label="名称" name="name" />
      <ProFormText label="笔画" name="sequence" />
      <ProFormSelect
        label="包含标签"
        name="tag"
        options={tags.map((x) => ({ label: x, value: x }))}
      />
      <ProFormSelect
        label="包含结构"
        name="operator"
        options={operators.map((x) => ({ label: x, value: x }))}
      />
      <Form.Item label="包含部分" name="part">
        <CharacterSelect allowClear={true} />
      </Form.Item>
    </QueryFilter>
  );
}
