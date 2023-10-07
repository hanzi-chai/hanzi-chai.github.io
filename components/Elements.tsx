import styled from "styled-components";
import RootPicker from "./RootPicker";
import RootsList from "./RootsList";
import { Col, Menu, Row, Select, Typography } from "antd";
import { useContext } from "react";
import { ConfigContext, useElement, useIndex, usePhonetic } from "./Context";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ConfigItem from "./ConfigItem";

const Switcher = styled(Menu)`
  justify-content: center;
  margin: 32px;
`;

const Elements = () => {
  const { elements } = useContext(ConfigContext);
  const navigate = useNavigate();
  const index = useIndex();
  return (
    <>
      <Switcher
        items={elements.map(({ type }, index) => ({
          key: index.toString(),
          label: `元素 ${index}: ${type}`,
        }))}
        mode="horizontal"
        selectedKeys={[index.toString()]}
        onClick={(e) => {
          navigate(e.key);
        }}
      />
      <Outlet />
    </>
  );
};

const ElementDispatch = () => {
  const element = useElement();
  if (element === undefined) return <></>;
  switch (element.type) {
    case "字根":
      return <RootElementConfig />;
    case "字音":
      return <PhoneticElementConfig />;
  }
};

const RootElementConfig = () => {
  return (
    <Row gutter={64} style={{ flex: "1", overflowY: "scroll" }}>
      <Col
        className="gutter-row"
        span={8}
        style={{ height: "100%", overflowY: "scroll" }}
      >
        <RootPicker />
      </Col>
      <Col
        className="gutter-row"
        span={16}
        style={{ height: "100%", overflowY: "scroll" }}
      >
        <RootsList />
      </Col>
    </Row>
  );
};

const PhoneticElementConfig = () => {
  const { mapping } = usePhonetic();
  const type = typeof mapping === "string" ? "恒等映射" : "自定义映射";
  const options = ["恒等映射", "自定义映射"] as const;
  return (
    <Row>
      <Col span={8}>
        <Typography.Title level={2}>来源</Typography.Title>
      </Col>
      <Col span={16}>
        <Typography.Title level={2}>键盘映射</Typography.Title>
        <ConfigItem label="类型">
          <Select
            value={type}
            style={{ width: "120px" }}
            options={options.map((x) => ({ label: x, value: x }))}
          />
        </ConfigItem>
      </Col>
    </Row>
  );
};

export { ElementDispatch as ElementConfig };

export default Elements;
