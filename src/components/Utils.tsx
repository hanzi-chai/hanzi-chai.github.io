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
  Tooltip,
  Upload,
} from "antd";
import { 二笔, type 元素识别结果, 单笔, 字符, type 码位 } from "hanzi-chai";
import type { ComponentProps, MouseEventHandler } from "react";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  别名显示原子,
  如私用区图形原子,
  强类型元素列表原子,
  键盘原子,
} from "~/atoms";
import BorderItem from "./BorderItem";
import { StrokesView } from "./GlyphView";
import Item from "./Item";

export const EditorRow = ({ className, ...props }: RowProps) => (
  <Row className={`h-full overflow-y-auto ${className ?? ""}`} {...props} />
);

export const EditorColumn = ({ className, ...props }: ColProps) => (
  <Col
    className={`gutter-row h-full overflow-y-auto flex flex-col px-[16px] ${className ?? ""}`}
    {...props}
  />
);

export const NumberInput = (({
  className,
  ...props
}: ComponentProps<typeof InputNumber>) => (
  <InputNumber
    className={`!w-[48px] [&_.ant-input-number-input]:!px-[8px] [&_.ant-input-number-input]:!py-[4px] ${className ?? ""}`}
    {...props}
  />
)) as unknown as typeof InputNumber;

export const Select = (({
  className,
  ...props
}: ComponentProps<typeof _Select>) => (
  <_Select className={`w-[96px] ${className ?? ""}`} {...props} />
)) as unknown as typeof _Select;

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

export const ElementDisplay = ({
  element,
  hideTypeNames,
  ...rest
}: {
  element: 元素识别结果;
  hideTypeNames?: boolean;
} & ComponentProps<"span">) => {
  if (typeof element === "string") {
    const text = hideTypeNames ? element.split("-").at(-1)! : element;
    return <span {...rest}>{text}</span>;
  }
  if (element instanceof 单笔 || element instanceof 二笔) {
    const name = element.获取名称();
    return <span {...rest}>{name}</span>;
  }
  if (element instanceof 字符) {
    return <CharacterDisplay {...rest} character={element} />;
  }
  return <span {...rest}>未知元素</span>;
};

export const CharacterDisplay = ({
  character,
  ...rest
}: {
  character: 字符;
} & ComponentProps<"span">) => {
  const 私用区图形 = useAtomValueUnwrapped(如私用区图形原子);
  const glyph = 私用区图形.get(character);
  if (!character.是私用区() || glyph === undefined) {
    return (
      <span {...rest} className={`whitespace-nowrap ${rest.className ?? ""}`}>
        {character.toString()}
      </span>
    );
  }
  return (
    <span {...rest}>
      <StrokesView glyph={glyph} />
    </span>
  );
};

export const ElementPositionDisplay = ({
  element,
  index,
}: {
  element: 元素识别结果;
  index: number;
}) => {
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return (
    <span>
      <ElementDisplay element={element} />
      {index ? superscripts[index] : ""}
    </span>
  );
};

export const CodePositionDisplay = ({ element }: { element: 码位 }) => {
  const 强类型元素列表 = useAtomValue(强类型元素列表原子);
  if (typeof element === "string") {
    return <span>{element}</span>;
  } else {
    const e = 强类型元素列表.get(element.element) ?? element.element;
    return <ElementPositionDisplay element={e} index={element.index} />;
  }
};

export const BoxedElementWithTooltip = ({
  element,
}: {
  element: 元素识别结果;
}) => {
  const display = useAtomValue(别名显示原子);
  const core = (
    <BorderItem
      onClick={() => navigator.clipboard.writeText(element.toString())}
    >
      <ElementDisplay element={element} />
    </BorderItem>
  );
  if (element instanceof 字符 && element.是私用区())
    return <Tooltip title={display(element)}>{core}</Tooltip>;
  return core;
};

interface ElementProps {
  element: string | 字符;
  setElement?: (s: string | 字符 | undefined) => void;
  currentElement?: string | 字符;
}

export const CharacterWithTooltip = ({
  element,
  setElement,
  currentElement,
}: ElementProps) => {
  const keyboard = useAtomValue(键盘原子);
  const { mapping } = keyboard;
  const type =
    element === currentElement
      ? "primary"
      : mapping[element.toString()]
        ? "link"
        : "default";
  const display = useAtomValue(别名显示原子);
  if (typeof element === "string") return element;
  const core = (
    <Item
      onClick={() =>
        setElement?.(element === currentElement ? undefined : element)
      }
      type={type}
    >
      {<CharacterDisplay character={element} />}
    </Item>
  );
  const title = element.是私用区()
    ? `${display(element)} ${element.十六进制()}`
    : element.十六进制();
  return <Tooltip title={title}>{core}</Tooltip>;
};
