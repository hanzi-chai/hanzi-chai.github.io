import type { ColProps, RowProps } from "antd";
import {
  Button,
  Col,
  InputNumber,
  Row,
  Upload,
  Select as _Select,
  notification,
} from "antd";
import styled from "styled-components";
import type { MouseEventHandler } from "react";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import MinusOutlined from "@ant-design/icons/MinusOutlined";
import { isPUA } from "~/lib";
import { StrokesView } from "./GlyphView";
import { glyphAtom, useAtomValue } from "~/atoms";

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

interface Click {
  onClick: MouseEventHandler<HTMLElement>;
  disabled?: boolean;
}

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

export const Display = ({
  name,
  alwaysUseGlyph,
}: {
  name: string;
  alwaysUseGlyph?: boolean;
}) => {
  const glyphMap = useAtomValue(glyphAtom);
  if (!isPUA(name) && !alwaysUseGlyph) {
    return name;
  }
  const glyph = glyphMap.get(name);
  if (glyph === undefined) {
    return name;
  }
  return <StrokesView glyph={glyph} />;
};
