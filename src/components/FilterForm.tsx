import {
  ProFormItem,
  ProFormSelect,
  ProFormText,
  QueryFilter,
} from "@ant-design/pro-components";
import { useAtomValue } from "jotai";
import { debounce } from "lodash-es";
import { 全部来源原子 } from "~/atoms";
import type { 过滤器参数 } from "~/utils";
import GlyphSelect from "./GlyphSelect";
import OperatorSelect from "./OperatorSelect";

interface StrokeSearchProps {
  isGlyph?: boolean;
  setFilter: (s: 过滤器参数) => void;
}

export default function FilterForm({ setFilter, isGlyph }: StrokeSearchProps) {
  const tags = useAtomValue(全部来源原子);
  const debounced = debounce(setFilter, 500);
  const idLabel = isGlyph ? "字形 ID" : "Unicode";
  const idPlaceholder = isGlyph ? "十进制" : "十或十六进制";
  const nameLabel = isGlyph ? "字形别名" : "字符";
  return (
    <QueryFilter<过滤器参数>
      onValuesChange={async (_, values) => debounced(values)}
      submitter={false}
      className="max-w-270"
      autoFocusFirstInput={false}
    >
      <ProFormText label={idLabel} name="id" placeholder={idPlaceholder}/>
      <ProFormText label={nameLabel} name="name" />
      <ProFormText label="笔画" name="sequence" />
      <ProFormSelect
        label="包含来源"
        name="source"
        options={tags.map((x) => ({ label: x, value: x }))}
      />
      <ProFormItem label="包含结构" name="operator">
        <OperatorSelect allowClear />
      </ProFormItem>
      <ProFormItem label="包含部分" name="part">
        <GlyphSelect allowClear />
      </ProFormItem>
    </QueryFilter>
  );
}
