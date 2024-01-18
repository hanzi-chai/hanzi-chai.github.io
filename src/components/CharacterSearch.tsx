import { Input } from "antd";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import { Repertoire } from "~/lib";

interface StrokeSearchProps {
  setSequence: (s: string) => void;
  disabled?: boolean;
}

export const makeFilter =
  (input: string, form: Repertoire, sequence: Map<string, string>) =>
  (char: string) => {
    let name = form[char]?.name ?? "";
    let seq = sequence.get(char) ?? "";
    return (
      name.includes(input) || char.includes(input) || seq.startsWith(input)
    );
  };

export default function ({ setSequence, disabled }: StrokeSearchProps) {
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
