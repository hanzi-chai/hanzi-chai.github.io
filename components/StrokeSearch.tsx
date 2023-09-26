import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { fullToHalf, halfToFull } from "./utils";
import { Classifier, RootConfig } from "../lib/config";
import defaultClassifier from "../templates/classifier.yaml";

interface StrokeSearchProps {
  sequence: string;
  classifier?: Classifier;
  setSequence: (s: string) => void;
}

const StrokeSearch = ({
  sequence,
  setSequence,
  classifier,
}: StrokeSearchProps) => {
  const numbers = Object.values(classifier || defaultClassifier);
  const valid = Array.from(sequence).every((x) =>
    numbers.includes(parseInt(x)),
  );
  return (
    <Input
      placeholder="输入笔画搜索（１２３４５．．）"
      status={valid ? undefined : "error"}
      onChange={(event) => {
        setSequence(fullToHalf(event.target.value));
      }}
      style={{ maxWidth: "400px" }}
      prefix={<SearchOutlined />}
      value={halfToFull(sequence)}
    />
  );
};

export default StrokeSearch;
