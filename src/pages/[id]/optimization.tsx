import { Typography } from "antd";
import { EditorColumn, EditorRow } from "~/components/Utils";

const Optimization = () => {
  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>优化目标</Typography.Title>
        <Typography.Title level={2}>优化方法</Typography.Title>
        <Typography.Title level={2}>优化约束</Typography.Title>
      </EditorColumn>
      <EditorColumn span={12}>
        <Typography.Title level={2}>优化进度</Typography.Title>
      </EditorColumn>
    </EditorRow>
  );
};

export default Optimization;
