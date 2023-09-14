import styled from "styled-components";
import RootPicker from "./RootPicker";
import RootsList from "./RootsList";
import { Col, Row } from "antd";

const Roots = () => {
  return <Row gutter={64}>
    <Col className="gutter-row" span={8}>
      <RootPicker />
    </Col>
    <Col className="gutter-row" span={16}>
      <RootsList />
    </Col>
  </Row>
}

export default Roots;
