import { Spin } from "antd";

export default function CustomSpin({ tip }: { tip: string }) {
  return (
    <Spin tip={tip} delay={300} style={{ marginTop: "4rem" }}>
      <h2></h2>
    </Spin>
  );
}
