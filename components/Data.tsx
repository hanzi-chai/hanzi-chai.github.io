import ComponentPicker from "./ComponentPicker";
import ComponentModel from "./ComponentModel";
import ComponentView from "./ComponentView";
import { useContext, useState } from "react";
import styled from "styled-components";
import { Col, Row } from "antd";

export default function Data() {
  const [componentName, setCurrentComponent] = useState("" as string);
  return (
    <Row gutter={32}>
      <Col className="gutter-row" span={8}>
        <ComponentPicker
          currentComponent={componentName}
          setCurrentComponent={setCurrentComponent}
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
`