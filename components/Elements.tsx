import RootPicker from "./RootPicker";
import Mapping from "./Mapping";
import { Flex, Form, Layout, Menu, Typography } from "antd";
import { useContext, useState } from "react";
import {
  ConfigContext,
  useDesign,
  useElement,
  useIndex,
  usePhonetic,
  useCharacters,
} from "./context";
import { Outlet, useNavigate } from "react-router-dom";
import analyzers from "../lib/pinyin";
import Root from "./Root";
import ElementAdder from "./ElementAdder";
import { EditorColumn, EditorRow, Select } from "./Utils";
import { isEmpty } from "underscore";

const Elements = () => {
  const { elements } = useContext(ConfigContext);
  const navigate = useNavigate();
  const index = useIndex();
  return (
    <Layout style={{ flex: 1 }}>
      <Layout.Sider theme="light">
        <Menu
          items={elements.map(({ type }, index) => ({
            key: index.toString(),
            label: `元素 ${index}: ${type}`,
          }))}
          selectedKeys={[index.toString()]}
          onClick={(e) => {
            navigate(e.key);
          }}
        />
      </Layout.Sider>
      <div style={{ padding: "0 32px", height: "100%" }}>
        <Outlet />
      </div>
    </Layout>
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
    <EditorRow>
      <EditorColumn span={8}>
        <RootPicker />
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>键盘映射</Typography.Title>
        <Mapping />
      </EditorColumn>
    </EditorRow>
  );
};

const PhoneticElementConfig = () => {
  const [name, setName] = useState<string | undefined>(undefined);
  const { mapping, nodes, alphabet } = usePhonetic();
  const type = isEmpty(mapping) ? "恒等映射" : "自定义映射";
  const options = ["恒等映射", "自定义映射"] as const;
  const design = useDesign();
  const characters = useCharacters();
  const syllables = [...new Set(Object.values(characters).flat())];
  const fn = analyzers[nodes[0]];
  const elements = [...new Set(syllables.map(fn).flat())].sort();
  return (
    <EditorRow>
      <EditorColumn span={8}>
        <Typography.Title level={2}>来源</Typography.Title>
        <Flex>
          {elements.map((x) => (
            <Root
              key={x}
              onClick={() => setName(x)}
              type={x === name ? "primary" : "default"}
            >
              {x}
            </Root>
          ))}
        </Flex>
        {type === "自定义映射" && <ElementAdder name={name} />}
      </EditorColumn>
      <EditorColumn span={16}>
        <Typography.Title level={2}>键盘映射</Typography.Title>
        {["首字母", "末字母"].includes(nodes[0]) && (
          <Form.Item label="类型">
            <Select
              value={type}
              options={options.map((x) => ({ label: x, value: x }))}
              onChange={(event) => {
                if (event === "恒等映射")
                  design({ subtype: "phonetic-automapping", value: {} });
                else
                  design({
                    subtype: "phonetic-automapping",
                    value: Object.fromEntries(
                      elements
                        .filter((x) => alphabet.includes(x))
                        .map((x) => [x, x]),
                    ),
                  });
              }}
            />
          </Form.Item>
        )}
        {!isEmpty(mapping) && <Mapping />}
      </EditorColumn>
    </EditorRow>
  );
};

export { ElementDispatch as ElementConfig };

export default Elements;
