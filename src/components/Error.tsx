/**
 * Error doundary page for Analysis & Elment router path.
 */

import { Result } from "antd";
import ConfigManager from "./ConfigManager";

export default function ErrorResult() {
  return (
    <Result
      status="500"
      title="数据异常"
      subTitle="点击下方的导出按钮，把您的配置反馈给我们。"
      extra={<ConfigManager />}
    />
  );
}
