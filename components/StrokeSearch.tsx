import Search from "antd/es/input/Search";

const onSearch = () => {};

const StrokeSearch = () => {
  return <Search
    placeholder="输入笔画搜索（ＨＳＰＤＺ）"
    onSearch={onSearch}
    style={{maxWidth: "400px"}}
    enterButton
  />
}

export default StrokeSearch;
