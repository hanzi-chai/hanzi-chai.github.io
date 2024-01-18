import type { ColProps, RowProps } from "antd";
import {
  Button,
  Col,
  Flex,
  InputNumber,
  Row,
  Space,
  Upload,
  Select as _Select,
  notification,
} from "antd";
import styled from "styled-components";
import { isValidCJKChar } from "~/lib";
import type { Err } from "~/api";
import { useEffect, useState } from "react";
import { dump } from "js-yaml";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import MinusOutlined from "@ant-design/icons/MinusOutlined";
import Root from "./Element";
import { Key } from "~/lib";
import useTitle from "ahooks/es/useTitle";
import {
  characterFrequencyAtom,
  fetchJson,
  keyDistributionAtom,
  pairEquivalenceAtom,
  wordFrequencyAtom,
} from "~/atoms";
import { useSetAtom } from "jotai";

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
  width: 96px;
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

type Click = { onClick: () => void; disabled?: boolean };

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

export const DeleteButton = ({ onClick, disabled }: Click) => {
  return (
    <Button
      shape="circle"
      type="text"
      danger
      onClick={onClick}
      disabled={disabled}
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

export const renderSuperScript = (element: string, index: number) => {
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return index ? element + superscripts[index + 1] : element;
};

export const joinKeys = (keys: Key[]) => {
  return keys.every((x) => typeof x === "string") ? keys.join("") : keys;
};

export const renderMapped = (mapped: string | Key[]) => {
  if (typeof mapped === "string") {
    return mapped;
  }
  return mapped.map((x) => {
    return typeof x === "string" ? x : renderSuperScript(x.element, x.index);
  });
};

export const makeWorker = () => {
  return new Worker(new URL("../worker.ts", import.meta.url), {
    type: "module",
  });
};

export function useChaifenTitle(title: string) {
  useTitle(`${title} · 汉字自动拆分系统 ${APP_VERSION}`, {
    restoreOnUnmount: true,
  });
}

export function LoadAssets() {
  const setCF = useSetAtom(characterFrequencyAtom);
  const setWF = useSetAtom(wordFrequencyAtom);
  const setKE = useSetAtom(keyDistributionAtom);
  const setPE = useSetAtom(pairEquivalenceAtom);
  fetchJson("character_frequency").then(setCF);
  fetchJson("word_frequency").then(setWF);
  fetchJson("key_distribution").then(setKE);
  fetchJson("pair_equivalence").then(setPE);
  return null;
}
