import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { fullToHalf, halfToFull } from "../lib/utils";
import { useContext } from "react";
import { ConfigContext } from "./Context";

interface StrokeSearchProps {
  sequence: string;
  setSequence: (s: string) => void;
}

const StrokeSearch = ({ sequence, setSequence }: StrokeSearchProps) => {
  const { classifier } = useContext(ConfigContext);
  const valid = Array.from(sequence).every((x) => classifier[x]);
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
