import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { fullToHalf, halfToFull } from "../lib/utils";
import { useContext } from "react";
import { ConfigContext } from "./Context";
import { RootConfig } from "../lib/config";

interface StrokeSearchProps {
  sequence: string;
  setSequence: (s: string) => void;
}

const StrokeSearch = ({ sequence, setSequence }: StrokeSearchProps) => {
  const { elements } = useContext(ConfigContext);
  const {
    analysis: { classifier },
  } = elements[0] as RootConfig;
  const numbers = Object.values(classifier);
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
