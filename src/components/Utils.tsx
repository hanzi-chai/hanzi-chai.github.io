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
import { useClassifier, useForm, useRoot } from "./context";
import { getSequence } from "../lib/form";

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
  width: 128px !important;
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
        label: v.name || x,
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
        label: v.name || x,
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
}: {
  char?: string;
  onChange: (s: string) => void;
  exclude: string;
}) => {
  const { mapping } = useRoot();
  const form = useForm();
  const classifier = useClassifier();
  return (
    <Select
      showSearch
      placeholder="输入笔画搜索"
      options={Object.keys(mapping)
        .filter((x) => x.match(/[\u4E00-\uFFFF]/))
        .filter((x) => x !== exclude)
        .map((x) => ({
          value: x,
          label: form[x]?.name || x,
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
