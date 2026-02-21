import {
  ProFormSelect,
  ProFormText,
  QueryFilter,
} from "@ant-design/pro-components";
import { Form } from "antd";
import { useAtomValue } from "jotai";
import { debounce } from "lodash-es";
import { 全部标签原子 } from "~/atoms";
import { 结构表示符列表 } from "~/lib";
import type { 字符过滤器参数 } from "~/utils";
import CharacterSelect from "./CharacterSelect";

interface StrokeSearchProps {
  setFilter: (s: 字符过滤器参数) => void;
}

export default function CharacterQuery({ setFilter }: StrokeSearchProps) {
  const tags = useAtomValue(全部标签原子);
  const debounced = debounce(setFilter, 500);
  return (
    <QueryFilter<字符过滤器参数>
      onValuesChange={async (_, values) => debounced(values)}
      submitter={false}
      style={{ maxWidth: 1080 }}
      autoFocusFirstInput={false}
    >
      <ProFormText label="Unicode" name="unicode" />
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
        options={结构表示符列表.map((x) => ({ label: x, value: x }))}
      />
      <Form.Item label="包含部分" name="part">
        <CharacterSelect allowClear={true} />
      </Form.Item>
    </QueryFilter>
  );
}
