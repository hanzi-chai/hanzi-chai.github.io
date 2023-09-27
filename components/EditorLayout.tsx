import {
  ChangeEvent,
  Dispatch,
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import { Button, Layout, Menu } from "antd";
import {
  DatabaseOutlined,
  MailOutlined,
  SettingOutlined,
  ProfileOutlined,
  BoldOutlined,
  CaretLeftFilled,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import {
  CacheContext,
  ConfigContext,
  DispatchContext,
  WriteContext,
  configReducer,
} from "./Context";
import { Config, ElementCache } from "../lib/config";
import { Action } from "./Context";
import styled from "styled-components";
import { dump } from "js-yaml";
import defaultConfig from "../templates/xingyin.yaml";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

const items: MenuProps["items"] = [
  {
    label: "基本",
    key: "index",
    icon: <MailOutlined />,
  },
  {
    label: "数据",
    key: "data",
    icon: <DatabaseOutlined />,
  },
  {
    label: "元素",
    key: "element",
    icon: <SettingOutlined />,
  },
  {
    label: "分析",
    key: "analysis",
    icon: <ProfileOutlined />,
  },
  {
    label: "编码",
    key: "encode",
    icon: <BoldOutlined />,
  },
];

const exportFile = (config: Config) => {
  const fileContent = dump(config, {
    flowLevel: 2,
    styles: { roots: { flowLevel: 1 } },
  });
  const blob = new Blob([fileContent], { type: "text/plain" });
  const a = document.createElement("a");
  a.download = `export.yaml`;
  a.href = window.URL.createObjectURL(blob);
  a.click();
};

const importFile = (
  dispatch: Dispatch<Action>,
  e: ChangeEvent<HTMLInputElement>,
) => {
  const [file] = e.target.files!;
  const reader = new FileReader();
  reader.addEventListener("load", () =>
    dispatch({
      type: "load",
      content: JSON.parse(reader.result as string),
    }),
  );
  reader.readAsText(file);
};

const NameAndBack = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  color: white;
`;

const Header = styled(Layout.Header)`
  display: flex;
  justify-content: space-around;
  align-items: center;
`;

const Content = styled(Layout.Content)`
  padding: 0px 32px;
  overflow-y: scroll;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const Footer = styled(Layout.Footer)`
  text-align: center;
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 1rem;
`;

const Wrapper = styled(Layout)`
  background-color: white !important;
`;

const EditorLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [_, id, panel] = pathname.split("/");
  const config = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);

  return (
    <Wrapper>
      <Header>
        <NameAndBack>
          <Link to="/">
            <Button icon={<CaretLeftFilled />} />
          </Link>
          <Title>{config.info.name}</Title>
        </NameAndBack>
        <Menu
          onClick={(e) => navigate(e.key === "index" ? "" : e.key)}
          selectedKeys={[panel || "index"]}
          theme="dark"
          mode="horizontal"
          items={items}
          style={{ width: "600px", justifyContent: "center" }}
        />
        <ActionGroup>
          <Button onClick={() => document.getElementById("import")!.click()}>
            导入
          </Button>
          <input
            type="file"
            id="import"
            hidden
            onChange={(e) => importFile(dispatch, e)}
          />
          <Button onClick={() => exportFile(config)}>导出</Button>
        </ActionGroup>
      </Header>
      <Content>
        <Outlet />
      </Content>
      <Footer>© 汉字自动拆分开发团队 2019 - {new Date().getFullYear()}</Footer>
    </Wrapper>
  );
};

const Contextualized = () => {
  const [config, dispatch] = useReducer(configReducer, defaultConfig as Config);
  const [cache, setCache] = useState([] as ElementCache[]);
  const { pathname } = useLocation();
  const [_, id, panel] = pathname.split("/");

  // read previous data
  // useEffect(() => {
  //   const previousConfig = JSON.parse(localStorage.getItem(id)!) as Config;
  //   dispatch({ type: "load", content: previousConfig });
  // }, []);

  return (
    <CacheContext.Provider value={cache}>
      <WriteContext.Provider value={setCache}>
        <ConfigContext.Provider value={config}>
          <DispatchContext.Provider value={dispatch}>
            <EditorLayout />
          </DispatchContext.Provider>
        </ConfigContext.Provider>
      </WriteContext.Provider>
    </CacheContext.Provider>
  );
};

export default Contextualized;
