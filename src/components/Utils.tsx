import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import MinusOutlined from "@ant-design/icons/MinusOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import type { ColProps, RowProps } from "antd";
import {
  Select as _Select,
  Button,
  Col,
  InputNumber,
  notification,
  Row,
  Upload,
} from "antd";
import type { MouseEventHandler } from "react";
import styled from "styled-components";
import { useAtomValueUnwrapped, 如私用区图形原子 } from "~/atoms";
import { 是私用区 } from "~/lib";
import { StrokesView } from "./GlyphView";

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
  type?: string;
}) => {
  return (
    <Upload
      accept={type ?? ".yaml"}
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

export const Display = ({ name, ...rest }: { name: string }) => {
  const glyphMap = useAtomValueUnwrapped(如私用区图形原子);
  if (!是私用区(name)) {
    return (
      <span {...rest} style={{ whiteSpace: "nowrap" }}>
        {/^\d$/.test(name)
          ? String.fromCodePoint(name.codePointAt(0)! + 0xff10 - 0x30)
          : name}
      </span>
    );
  }
  const glyph = glyphMap.get(name);
  if (glyph === undefined) {
    return <span {...rest}>{name}</span>;
  }
  return (
    <span {...rest}>
      <StrokesView glyph={glyph} />
    </span>
  );
};

export const DisplayWithSuperScript = ({
  name,
  index,
}: {
  name: string;
  index: number;
}) => {
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return (
    <span>
      <Display name={name} />
      {index ? superscripts[index] : ""}
    </span>
  );
};
