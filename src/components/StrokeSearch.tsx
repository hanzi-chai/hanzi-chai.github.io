import { Input } from "antd";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import { fullToHalf, halfToFull } from "~/lib/utils";

interface StrokeSearchProps {
  setSequence: (s: string) => void;
  disabled?: boolean;
}

export default function ({ setSequence, disabled }: StrokeSearchProps) {
  return (
    <Input
      placeholder="输入笔画（１２３４５．．．）或汉字搜索"
      onChange={(event) => {
        setSequence(fullToHalf(event.target.value));
      }}
      prefix={<SearchOutlined />}
      disabled={disabled}
    />
  );
}
