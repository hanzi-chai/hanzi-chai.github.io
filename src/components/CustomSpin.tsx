import { Spin } from "antd";

export default function CustomSpin({ tip }: { tip: string }) {
  return (
    <Spin description={tip} delay={300} style={{ marginTop: "4rem" }}>
      <div />
    </Spin>
  );
}
