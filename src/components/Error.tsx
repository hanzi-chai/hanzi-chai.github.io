/**
 * Error doundary page for Analysis & Elment router path.
 */

import { Result } from "antd";
import ConfigManager from "./ConfigManager";
import React from "react";
import { useRouteError } from "react-router-dom";

function BacsErrorResult() {
  return (
    <Result
      status="500"
      title="数据异常"
      subTitle="点击下方的导出按钮，把您的配置反馈给我们。"
      extra={<ConfigManager />}
    />
  );
}

export default function ErrorResult(props: any) {
  const error = useRouteError() as any;
  if (error || props.error) {
    return (
      <>
        <p className="text-center">
          捕获到错误：
          <span className="text-red-500">
            {" "}
            {error?.message || props.error.message}
          </span>
        </p>
        <BacsErrorResult />
      </>
    );
  }
  return <BacsErrorResult />;
}

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    this.setState({ error });
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorResult {...this.state} />;
    }
    return this.props.children;
  }
}
