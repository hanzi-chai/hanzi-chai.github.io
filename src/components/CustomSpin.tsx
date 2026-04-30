import { Spin } from "antd";

export default function CustomSpin({ tip }: { tip: string }) {
  return (
    <Spin tip={tip} delay={300} className="mt-16">
      <div />
    </Spin>
  );
}
