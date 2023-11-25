/**
 * Error doundary page for Analysis & Elment router path.
 */

import { Result, Typography } from "antd";

export default function () {
  return (
    <Result
      status="500"
      title="数据异常"
      subTitle="点击右上角的导出，把您的配置反馈给我们。"
    />
  );
}
