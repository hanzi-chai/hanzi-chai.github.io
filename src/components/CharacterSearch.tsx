import { Input } from "antd";
import SearchOutlined from "@ant-design/icons/SearchOutlined";

interface StrokeSearchProps {
  setSequence: (s: string) => void;
  disabled?: boolean;
}

export default function CharacterSearch({
  setSequence,
  disabled,
}: StrokeSearchProps) {
  return (
    <Input
      placeholder="输入笔画（12345）或汉字搜索"
      onChange={(event) => {
        setSequence(event.target.value);
      }}
      prefix={<SearchOutlined />}
      disabled={disabled}
    />
  );
}
