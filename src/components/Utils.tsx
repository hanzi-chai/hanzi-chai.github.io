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
import {
  getRecordFromTSV,
  getDictFromTSV,
  getDistributionFromTSV,
} from "~/lib";
import { useEffect, useState } from "react";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import MinusOutlined from "@ant-design/icons/MinusOutlined";
import Root from "./Element";
import {
  defaultDictionaryAtom,
  fetchAsset,
  frequencyAtom,
  keyDistributionAtom,
  pairEquivalenceAtom,
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
  disabled,
  text,
  type,
}: {
  action: (s: string) => void;
  disabled?: boolean;
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
      <Button disabled={disabled}>{text || "导入"}</Button>
    </Upload>
  );
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

export function LoadAssets() {
  const setF = useSetAtom(frequencyAtom);
  const setW = useSetAtom(defaultDictionaryAtom);
  const setKE = useSetAtom(keyDistributionAtom);
  const setPE = useSetAtom(pairEquivalenceAtom);
  fetchAsset("frequency", "txt").then((x) => setF(getRecordFromTSV(x)));
  fetchAsset("dictionary", "txt").then((x) => setW(getDictFromTSV(x)));
  fetchAsset("key_distribution", "txt").then((x) =>
    setKE(getDistributionFromTSV(x)),
  );
  fetchAsset("pair_equivalence", "txt").then((x) => setPE(getRecordFromTSV(x)));
  return null;
}
