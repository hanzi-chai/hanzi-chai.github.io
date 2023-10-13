import {
  ChangeEvent,
  Dispatch,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { Button, Layout, Menu, Typography } from "antd";
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
  cacheReducer,
  configReducer,
} from "./context";
import { Config, ElementCache } from "../lib/config";
import { Action } from "./context";
import styled from "styled-components";
import { dump } from "js-yaml";
import defaultConfig from "../templates/default.yaml";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useImmerReducer } from "use-immer";
import { FlexContainer } from "./Utils";

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

const defaultChildren: Record<string, string> = {
  data: "/component",
  element: "/0",
  analysis: "/0",
};

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
      value: JSON.parse(reader.result as string),
    }),
  );
  reader.readAsText(file);
};

const Header = styled(Layout.Header)`
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0;
`;

const Content = styled(Layout.Content)`
  padding: 0px 32px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Footer = styled(Layout.Footer)`
  text-align: center;
`;

const EditorLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [_, __, panel] = pathname.split("/");
  const config = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);

  return (
    <Layout>
      <Header>
        <FlexContainer>
          <Link to="/">
            <Button icon={<CaretLeftFilled />} />
          </Link>
          <Typography.Title
            level={1}
            style={{ fontSize: "32px", color: "white" }}
          >
            {config.info.name}
          </Typography.Title>
        </FlexContainer>
        <Menu
          onClick={(e) =>
            navigate(
              e.key === "index" ? "" : e.key + (defaultChildren[e.key] || ""),
            )
          }
          selectedKeys={[panel || "index"]}
          theme="dark"
          mode="horizontal"
          items={items}
          style={{ width: "440px", justifyContent: "center" }}
        />
        <FlexContainer>
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
        </FlexContainer>
      </Header>
      <Content>
        <Outlet />
      </Content>
      <Footer>© 汉字自动拆分开发团队 2019 - {new Date().getFullYear()}</Footer>
    </Layout>
  );
};

const Contextualized = () => {
  const { pathname } = useLocation();
  const [_, id] = pathname.split("/");
  const [config, dispatch] = useImmerReducer(
    configReducer,
    defaultConfig as Config,
    () => {
      return JSON.parse(localStorage.getItem(id)!) as Config;
    },
  );
  const [cache, write] = useReducer(cacheReducer, {} as ElementCache);

  useEffect(() => {
    localStorage.setItem(id, JSON.stringify(config));
  }, [config, id]);

  return (
    <CacheContext.Provider value={cache}>
      <WriteContext.Provider value={write}>
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
