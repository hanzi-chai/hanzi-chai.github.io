import styled from "styled-components";
import RootPicker from "./RootPicker";
import Mapping from "./Mapping";
import { Col, Form, Menu, Row, Select, Typography } from "antd";
import { useContext, useState } from "react";
import {
  ConfigContext,
  DispatchContext,
  useDesign,
  useElement,
  useIndex,
  usePhonetic,
  useYinCustomized,
} from "./Context";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import analyzers from "../lib/pinyin";
import Root from "./Root";
import ElementAdder from "./ElementAdder";

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
        <Typography.Title level={2}>键盘映射</Typography.Title>
        <Mapping />
      </Col>
    </Row>
  );
};

const PhoneticElementContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
`;

const PhoneticElementConfig = () => {
  const [name, setName] = useState<string | undefined>(undefined);
  const { mapping, nodes } = usePhonetic();
  const type = mapping === undefined ? "恒等映射" : "自定义映射";
  const options = ["恒等映射", "自定义映射"] as const;
  const design = useDesign();
  const yin = useYinCustomized();
  const syllables = [...new Set(Object.values(yin).flat())];
  const fn = analyzers[nodes[0]];
  const elements = [...new Set(syllables.map(fn).flat())].sort();
  return (
    <Row gutter={64} style={{ flex: "1", overflowY: "scroll" }}>
      <Col span={8}>
        <Typography.Title level={2}>来源</Typography.Title>
        <PhoneticElementContainer>
          {elements.map((x) => (
            <Root
              key={x}
              onClick={() => setName(x)}
              type={x === name ? "primary" : "default"}
            >
              {x}
            </Root>
          ))}
        </PhoneticElementContainer>
        {type === "自定义映射" && <ElementAdder name={name} />}
      </Col>
      <Col span={16}>
        <Typography.Title level={2}>键盘映射</Typography.Title>
        {["首字母", "末字母"].includes(nodes[0]) && (
          <Form.Item label="类型">
            <Select
              value={type}
              style={{ width: "120px" }}
              options={options.map((x) => ({ label: x, value: x }))}
              onChange={(event) => {
                if (event === "恒等映射")
                  design({ subtype: "phonetic-automapping", value: undefined });
                else design({ subtype: "phonetic-automapping", value: {} });
              }}
            />
          </Form.Item>
        )}
        {mapping !== undefined && <Mapping />}
      </Col>
    </Row>
  );
};

export { ElementDispatch as ElementConfig };

export default Elements;
