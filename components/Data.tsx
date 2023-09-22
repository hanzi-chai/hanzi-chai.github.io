import ComponentModel from "./ComponentModel";
import ComponentView from "./ComponentView";
import { useContext, useState } from "react";
import styled from "styled-components";
import { Col, Menu, MenuProps, Row, Typography } from "antd";
import { MailOutlined, AppstoreOutlined } from "@ant-design/icons";
import StrokeSearch from "./StrokeSearch";
import CompoundModel from "./CompoundModel";
import Pool from "./Pool";

const items: MenuProps["items"] = [
  {
    label: "部件",
    key: "component",
    icon: <MailOutlined />,
  },
  {
    label: "复合体",
    key: "compound",
    icon: <AppstoreOutlined />,
  },
];

const Switcher = styled(Menu)`
  justify-content: center;
  margin: 32px;
`;

export default function Data() {
  const [mode, setMode] = useState("component" as "component" | "compound");
  const [name, setName] = useState(undefined as string | undefined);
  const [sequence, setSequence] = useState("");
  return (
    <>
      <Switcher
        items={items}
        mode="horizontal"
        selectedKeys={[mode]}
        onClick={(e) => {
          setMode(e.key as typeof mode);
          setName(undefined);
          setSequence("");
        }}
      />
      <Row gutter={32}>
        <Col className="gutter-row" span={mode === "component" ? 8 : 16}>
          <Typography.Title level={2}>
            选择{mode === "component" ? "部件" : "复合体"}
          </Typography.Title>
          <StrokeSearch sequence={sequence} setSequence={setSequence} />
          <Pool type={mode} name={name} setName={setName} sequence={sequence} />
        </Col>
        {mode === "component" && (
          <Col className="gutter-row" span={8}>
            <ComponentView componentName={name} />
          </Col>
        )}
        <Col className="gutter-row" span={8}>
          {mode === "component" ? (
            <ComponentModel componentName={name} />
          ) : (
            <CompoundModel name={name} />
          )}
        </Col>
      </Row>
    </>
  );
}

const Main = styled.main`
  display: flex;
`;
