import ComponentModel from "./ComponentModel";
import ComponentView from "./ComponentView";
import { useContext, useState } from "react";
import styled from "styled-components";
import { Col, Menu, MenuProps, Row, Typography } from "antd";
import { MailOutlined, AppstoreOutlined } from "@ant-design/icons";
import StrokeSearch from "./StrokeSearch";
import CompoundModel from "./CompoundModel";
import Pool from "./Pool";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import EditableTable from "./EditableTable";

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
  {
    label: "字音",
    key: "character",
    icon: <AppstoreOutlined />,
  },
];

const Switcher = styled(Menu)`
  justify-content: center;
  margin: 32px;
`;

export default function Data() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [_, id, data, mode] = pathname.split("/");
  return (
    <>
      <Switcher
        items={items}
        mode="horizontal"
        selectedKeys={[mode]}
        onClick={(e) => {
          navigate(e.key);
        }}
      />
      <Outlet />
    </>
  );
}

const ComponentData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  const [sequence, setSequence] = useState("");
  return (
    <Row gutter={32}>
      <Col className="gutter-row" span={8}>
        <Typography.Title level={2}>选择部件</Typography.Title>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <Pool
          type="component"
          name={name}
          setName={setName}
          sequence={sequence}
        />
      </Col>
      <Col className="gutter-row" span={8}>
        <ComponentView name={name} />
      </Col>
      <Col className="gutter-row" span={8}>
        <ComponentModel name={name} />
      </Col>
    </Row>
  );
};

const CompoundData = () => {
  const [name, setName] = useState(undefined as string | undefined);
  const [sequence, setSequence] = useState("");
  return (
    <Row gutter={32}>
      <Col className="gutter-row" span={16}>
        <Typography.Title level={2}>选择复合体</Typography.Title>
        <StrokeSearch sequence={sequence} setSequence={setSequence} />
        <Pool
          type="compound"
          name={name}
          setName={setName}
          sequence={sequence}
        />
      </Col>
      <Col className="gutter-row" span={8}>
        <CompoundModel name={name} />
      </Col>
    </Row>
  );
};

const CharacterData = EditableTable;

export { ComponentData, CompoundData, CharacterData };
