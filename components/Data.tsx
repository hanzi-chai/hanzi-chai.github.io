import ComponentModel from "./ComponentModel";
import ComponentView from "./ComponentView";
import { useContext, useState } from "react";
import styled from "styled-components";
import { Col, Row, Typography } from "antd";
import StrokeSearch from "./StrokeSearch";
import Pool from "./Pool";

export default function Data() {
  const [componentName, setComponentName] = useState(
    undefined as string | undefined,
  );
  const [sequence, setSequence] = useState("");
  return (
    <Row gutter={32}>
      <Col className="gutter-row" span={8}>
        <Typography.Title level={2}>选择部件</Typography.Title>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <Pool
          componentName={componentName}
          setComponentName={setComponentName}
          sequence={sequence}
        />
      </Col>
      <Col className="gutter-row" span={8}>
        <ComponentView componentName={componentName} />
      </Col>
      <Col className="gutter-row" span={8}>
        <ComponentModel componentName={componentName} />
      </Col>
    </Row>
  );
}

const Main = styled.main`
  display: flex;
`;
