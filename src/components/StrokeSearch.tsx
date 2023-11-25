import { Input } from "antd";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import { fullToHalf, halfToFull } from "~/lib/utils";
import { useClassifier } from "./contants";

interface StrokeSearchProps {
  sequence: string;
  setSequence: (s: string) => void;
}

const StrokeSearch = ({ sequence, setSequence }: StrokeSearchProps) => {
  const classifier = useClassifier();
  const numbers = Object.values(classifier);
  const valid = Array.from(sequence).every((x) =>
    numbers.includes(parseInt(x, 10)),
  );
  return (
    <Input
      placeholder="输入笔画搜索（１２３４５．．）"
      status={valid ? undefined : "error"}
      onChange={(event) => {
        setSequence(fullToHalf(event.target.value));
      }}
      prefix={<SearchOutlined />}
      value={halfToFull(sequence)}
    />
  );
};

export default StrokeSearch;
