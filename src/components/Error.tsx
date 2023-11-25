/**
 * Error doundary page for Analysis & Elment router path.
 */

import { Result } from "antd";

export default function ErrorResult() {
  return (
    <Result
      status="500"
      title="数据异常"
      subTitle="点击右上角的导出，把您的配置反馈给我们。"
    />
  );
}
