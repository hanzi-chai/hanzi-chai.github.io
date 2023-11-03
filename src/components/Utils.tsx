import {
  Button,
  Col,
  ColProps,
  InputNumber,
  Row,
  RowProps,
  Upload,
  Select as _Select,
} from "antd";
import styled from "styled-components";
import { useFormConfig } from "./context";
import { useForm, useClassifier } from "./contants";
import { getSequence } from "~/lib/form";
import { displayName } from "~/lib/utils";

const ScrollableRow = styled(Row)`
  height: 100%;
  overflow-y: auto;
`;

export const EditorRow = (props: RowProps) => (
  <ScrollableRow {...props} gutter={32} />
);

const ScrollableColumn = styled(Col)`
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const EditorColumn = (props: ColProps) => (
  <ScrollableColumn className="gutter-row" {...props} />
);

export const NumberInput = styled(InputNumber)`
  width: 48px;
  & .ant-input-number-input {
    padding: 4px 8px;
  }
`;

export const Select = styled(_Select)`
  width: 128px;
` as typeof _Select;

export const Uploader = ({
  action,
  text,
}: {
  action: (s: string) => void;
  text?: string;
}) => {
  return (
    <Upload
      accept=".yaml,.json"
      customRequest={({ file }) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => action(reader.result as string));
        reader.readAsText(file as File);
      }}
      maxCount={1}
      showUploadList={false}
    >
      <Button>{text || "导入"}</Button>
    </Upload>
  );
};

export const ItemSelect = ({
  char,
  onChange,
}: {
  char?: string;
  onChange: (s: string) => void;
}) => {
  const form = useForm();
  const classifier = useClassifier();
  return (
    <Select
      showSearch
      placeholder="输入笔画搜索"
      options={Object.entries(form).map(([x, v]) => ({
        value: x,
        label: displayName(x, v),
      }))}
      value={char}
      onChange={onChange}
      filterOption={(input, option) =>
        getSequence(form, classifier, option!.value).startsWith(input)
      }
      filterSort={(a, b) => {
        return (
          getSequence(form, classifier, a.value).length -
          getSequence(form, classifier, b.value).length
        );
      }}
    />
  );
};

export const ReferenceSelect = ({
  char,
  onChange,
}: {
  char?: string;
  onChange: (s: string) => void;
}) => {
  const form = useForm();
  const classifier = useClassifier();
  return (
    <Select
      showSearch
      placeholder="输入 unicode 搜索"
      options={Object.entries(form).map(([x, v]) => ({
        value: x,
        label: displayName(x, v),
      }))}
      value={char}
      onChange={onChange}
      filterOption={(input, option) => {
        const glyph = form[option!.value];
        const c = String.fromCodePoint(Number(input));
        if (glyph.default_type === 1) {
          return glyph.slice.source === c;
        } else if (glyph.default_type === 2) {
          return glyph.compound.operandList.includes(c);
        }
        return false;
      }}
      filterSort={(a, b) => {
        return (
          getSequence(form, classifier, a.value).length -
          getSequence(form, classifier, b.value).length
        );
      }}
    />
  );
};

export const RootSelect = ({
  char,
  onChange,
  exclude,
  withGrouped,
}: {
  char?: string;
  onChange: (s: string) => void;
  exclude: string;
  withGrouped?: boolean;
}) => {
  const { mapping, grouping } = useFormConfig();
  const form = useForm();
  const classifier = useClassifier();
  const keys = withGrouped
    ? Object.keys(mapping).concat(Object.keys(grouping))
    : Object.keys(mapping);
  return (
    <Select
      style={{ width: "96px" }}
      showSearch
      placeholder="输入笔画搜索"
      options={keys
        .filter((x) => x.match(/[\u4E00-\uFFFF]/) || x.match(/\d+/))
        .filter((x) => x !== exclude)
        .map((x) => ({
          value: x,
          label: displayName(x, form[x])!,
        }))}
      value={char}
      onChange={onChange}
      filterOption={(input, option) =>
        getSequence(form, classifier, option!.value).startsWith(input)
      }
      filterSort={(a, b) => {
        return (
          getSequence(form, classifier, a.value).length -
          getSequence(form, classifier, b.value).length
        );
      }}
    />
  );
};

export type Index = { char: string };
export type IndexEdit = {
  char: string | undefined;
  setChar: (s: string | undefined) => void;
};
export type IndexEdit2 = {
  char: string;
  setChar: (s: string) => void;
};

export const exportFile = (unsafeContent: string, filename: string) => {
  const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
    return `"\\u${c.codePointAt(0)!.toString(16)}"`;
  });
  const blob = new Blob([fileContent], { type: "text/plain" });
  const a = document.createElement("a");
  a.download = filename;
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.click();
  window.URL.revokeObjectURL(url); // 避免内存泄漏
};

export const exportJSON = (unsafeContent: string, filename: string) => {
  const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
    return `\\u${c.codePointAt(0)!.toString(16)}`;
  });
  const blob = new Blob([fileContent], { type: "text/plain" });
  const a = document.createElement("a");
  a.download = filename;
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.click();
  window.URL.revokeObjectURL(url); // 避免内存泄漏
};
