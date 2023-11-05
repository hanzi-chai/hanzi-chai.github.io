import {
  Button,
  Col,
  ColProps,
  InputNumber,
  Row,
  RowProps,
  SelectProps,
  Upload,
  Select as _Select,
  notification,
} from "antd";
import styled from "styled-components";
import { useFormConfig } from "./context";
import { useForm, useClassifier } from "./contants";
import { getSequence } from "~/lib/form";
import { displayName, validUnicode } from "~/lib/utils";
import { Err } from "~/lib/api";
import { useEffect, useState } from "react";
import classifier from "~/lib/classifier";
import { dump } from "js-yaml";

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
export type IndexEdit2 = {
  char: string;
  setChar: (s: string) => void;
};
export type IndexEdit3 = {
  char: string;
  setChar: (s?: string) => void;
};

const processExport = (blob: Blob, filename: string) => {
  const a = document.createElement("a");
  a.download = filename;
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.click();
  window.URL.revokeObjectURL(url); // 避免内存泄漏
};

export const exportYAML = (config: object, filename: string) => {
  const unsafeContent = dump(config, { flowLevel: 4 });
  const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
    return `"\\u${c.codePointAt(0)!.toString(16)}"`;
  });
  const blob = new Blob([fileContent], { type: "text/plain" });
  processExport(blob, filename);
};

export const exportJSON = (data: object, filename: string) => {
  const unsafeContent = JSON.stringify(data);
  const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
    return `\\u${c.codePointAt(0)!.toString(16)}`;
  });
  const blob = new Blob([fileContent], { type: "text/plain" });
  processExport(blob, filename);
};

export const ItemSelect = (props: SelectProps) => {
  const form = useForm();
  const [data, setData] = useState<SelectProps["options"]>([]);
  const char = props.value;
  useEffect(() => {
    const initial = char
      ? [{ value: char, label: displayName(char, form[char]) }]
      : [];
    setData(initial);
  }, [props.value]);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = Object.entries(form)
      .map(([x, v]) => ({
        value: x,
        label: displayName(x, v),
      }))
      .filter(({ value }) => {
        return getSequence(form, classifier, value).startsWith(input);
      })
      .sort((a, b) => {
        return (
          getSequence(form, classifier, a.value).length -
          getSequence(form, classifier, b.value).length
        );
      });
    const minResults = allResults.filter(
      ({ value }) =>
        getSequence(form, classifier, value).length === input.length,
    );
    setData(allResults.slice(0, Math.max(5, minResults.length)));
  };
  const commonProps: SelectProps = {
    showSearch: true,
    placeholder: "输入笔画搜索",
    options: data,
    filterOption: false,
    onSearch,
  };
  return <Select style={{ width: "96px" }} {...props} {...commonProps} />;
};

export const errorFeedback = function <T extends number | boolean>(
  res: T | Err,
): res is Err {
  if (typeof res === "object") {
    notification.error({
      message: "无法完成该操作",
      description: JSON.stringify(res),
    });
    return true;
  } else {
    notification.success({
      message: "操作成功",
    });
    return false;
  }
};

export const verifyNewName = (newName: string) => {
  if (!Array.from(newName).every(validUnicode)) {
    notification.error({
      message: "名称含有非法字符",
      description: "合法字符的范围：0x4e00 - 0x9fff，或 0x3400 - 0x4dbf",
    });
    return false;
  }
  return true;
};
