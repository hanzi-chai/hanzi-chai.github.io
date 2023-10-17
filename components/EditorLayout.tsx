import {
  ChangeEvent,
  Dispatch,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { Button, Flex, Layout, Menu, Space, Typography, Upload } from "antd";
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
import { dump, load } from "js-yaml";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useImmerReducer } from "use-immer";
import { Uploader } from "./Utils";
import { templates } from "../lib/template";

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
  data: "/components",
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

const EditorLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [_, __, panel] = pathname.split("/");
  const config = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);

  return (
    <Layout
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Layout.Header>
        <Flex justify="space-between" align="center">
          <Flex gap="small">
            <Link to="/">
              <Button icon={<CaretLeftFilled />} />
            </Link>
            <Typography.Title style={{ fontSize: "24px", color: "white" }}>
              {config.info.name}
            </Typography.Title>
          </Flex>
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
          />
          <Space>
            <Uploader
              action={(s: string) => {
                dispatch({ type: "load", value: load(s) as Config });
              }}
            />
            <Button onClick={() => exportFile(config)}>导出</Button>
            <Button
              onClick={() => {
                dispatch({
                  type: "load",
                  value: templates[config.template].self,
                });
              }}
            >
              重置
            </Button>
          </Space>
        </Flex>
      </Layout.Header>
      <Outlet />
    </Layout>
  );
};

const Contextualized = () => {
  const { pathname } = useLocation();
  const [_, id] = pathname.split("/");
  const [config, dispatch] = useImmerReducer(configReducer, undefined, () => {
    return JSON.parse(localStorage.getItem(id)!) as Config;
  });
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
