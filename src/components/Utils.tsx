import type { ColProps, RowProps, SelectProps } from "antd";
import {
  Button,
  Col,
  Dropdown,
  Flex,
  InputNumber,
  Row,
  Space,
  Upload,
  Select as _Select,
  notification,
} from "antd";
import styled from "styled-components";
import {
  useAtomValue,
  configFormAtom,
  customFormAtom,
  sequenceAtom,
  sortedCustomFormAtom,
  displayAtom,
} from "~/atoms";
import { isValidCJKChar } from "~/lib/utils";
import type { Err } from "~/lib/api";
import { useEffect, useState } from "react";
import { dump } from "js-yaml";
import { Glyph } from "~/lib/data";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import MinusOutlined from "@ant-design/icons/MinusOutlined";
import Root from "./Root";

const ScrollableRow = styled(Row)`
  height: 100%;
  overflow-y: auto;
`;

export const EditorRow = (props: RowProps) => <ScrollableRow {...props} />;

const ScrollableColumn = styled(Col)`
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-left: 16px;
  padding-right: 16px;
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
  type,
}: {
  action: (s: string) => void;
  text?: string;
  type?: "yaml" | "json" | "txt";
}) => {
  return (
    <Upload
      accept={"." + (type ?? "yaml")}
      customRequest={({ file }) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          const result = reader.result;
          if (typeof result === "string") {
            action(result);
          } else {
            notification.error({
              message: "无法获取文件内容",
            });
          }
        });
        reader.readAsText(file as File);
      }}
      maxCount={1}
      showUploadList={false}
    >
      <Button>{text || "导入"}</Button>
    </Upload>
  );
};

export interface ElementSelectProps {
  char?: string;
  onChange: (s: string) => void;
  customFilter?: (s: string) => boolean;
  excludeGrouped?: boolean;
  onlyRootsAndStrokes?: boolean;
}

export const ElementSelect = ({
  char,
  onChange,
  customFilter,
  excludeGrouped,
  onlyRootsAndStrokes,
}: ElementSelectProps) => {
  const { mapping, grouping } = useAtomValue(configFormAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  const form = useAtomValue(customFormAtom);
  let keys = Object.keys(mapping).concat(Object.keys(grouping));
  if (excludeGrouped) {
    keys = keys.filter((x) => grouping[x] === undefined);
  }
  if (onlyRootsAndStrokes) {
    keys = keys.filter((x) => form[x] || x.match(/\d/));
  }
  if (customFilter) {
    keys = keys.filter(customFilter);
  }
  const display = useAtomValue(displayAtom);
  return (
    <Select
      style={{ width: "96px" }}
      showSearch
      placeholder="输入笔画搜索"
      options={keys.map((x) => ({
        value: x,
        label: display(x),
      }))}
      value={char}
      onChange={onChange}
      filterOption={(input, option) => {
        if (option === undefined) return false;
        const value = option.value;
        if (form[value] !== undefined) {
          return sequenceMap.get(value)!.startsWith(input);
        } else {
          return value.includes(input);
        }
      }}
      filterSort={(a, b) => {
        return (
          (sequenceMap.get(a.value) ?? "").length -
          (sequenceMap.get(b.value) ?? "").length
        );
      }}
    />
  );
};

export interface Index {
  char: string;
}
export interface IndexEdit2 {
  char: string;
  setChar: (s?: string) => void;
}
export interface IndexEdit3 {
  char: string;
  setChar: (s?: string) => void;
}

const processExport = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/plain" });
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
  processExport(fileContent, filename + ".yaml");
};

export const exportJSON = (data: object, filename: string) => {
  const unsafeContent = JSON.stringify(data);
  const fileContent = unsafeContent.replace(/[\uE000-\uFFFF]/g, (c) => {
    return `\\u${c.codePointAt(0)!.toString(16)}`;
  });
  processExport(fileContent, filename);
};

export const exportTSV = (data: string[][], filename: string) => {
  const fileContent = data.map((x) => x.join("\t")).join("\n");
  processExport(fileContent, filename);
};

interface ItemSelectProps extends SelectProps {
  customFilter?: (e: [string, Glyph]) => boolean;
}

export const ItemSelect = (props: ItemSelectProps) => {
  const { customFilter, ...rest } = props;
  const sortedForm = useAtomValue(sortedCustomFormAtom);
  const [data, setData] = useState<SelectProps["options"]>([]);
  const char = props.value;
  const display = useAtomValue(displayAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  useEffect(() => {
    const initial = char ? [{ value: char, label: display(char) }] : [];
    setData(initial);
  }, [props.value]);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = sortedForm
      .filter(props.customFilter ?? ((_) => true))
      .map(([x]) => ({
        value: x,
        label: display(x),
      }))
      .filter(({ value }) => {
        return sequenceMap.get(value)?.startsWith(input);
      });
    const minResults = allResults.filter(
      ({ value }) => sequenceMap.get(value)?.length === input.length,
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
  return <Select style={{ width: "96px" }} {...rest} {...commonProps} />;
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
  if (!Array.from(newName).every(isValidCJKChar)) {
    notification.error({
      message: "名称含有非法字符",
      description: "只有 CJK 基本集或扩展集 A 中的才是合法字符",
    });
    return false;
  }
  return true;
};

type Click = { onClick: () => void };

export const PlusButton = ({ onClick }: Click) => {
  return (
    <Button
      shape="circle"
      type="text"
      onClick={onClick}
      icon={<PlusOutlined />}
    />
  );
};

export const MinusButton = ({ onClick }: Click) => {
  return (
    <Button
      shape="circle"
      type="text"
      onClick={onClick}
      icon={<MinusOutlined />}
    />
  );
};

export const DeleteButton = ({ onClick }: Click) => {
  return (
    <Button
      shape="circle"
      type="text"
      danger
      onClick={onClick}
      icon={<DeleteOutlined />}
    />
  );
};

export const KeyList = ({
  keys,
  setKeys,
  allKeys,
}: {
  keys: string[];
  setKeys: (s: string[]) => void;
  allKeys: string[];
}) => {
  const [currentKey, setCurrentKey] = useState(allKeys[0]!);
  return (
    <Flex justify="space-between">
      <Space>
        {keys.map((x, index) => (
          <Root key={index}>{x}</Root>
        ))}
      </Space>
      <Space>
        <PlusButton onClick={() => setKeys(keys.concat(currentKey))} />
        <Select
          value={currentKey}
          options={allKeys.map((k) => ({ label: k, value: k }))}
          style={{ width: 72 }}
          onChange={setCurrentKey}
        />
        <MinusButton onClick={() => setKeys(keys.slice(0, keys.length - 1))} />
      </Space>
    </Flex>
  );
};
