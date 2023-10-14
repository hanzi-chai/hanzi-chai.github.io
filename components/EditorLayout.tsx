import {
  ChangeEvent,
  Dispatch,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { Button, Flex, Layout, Menu, Space, Typography } from "antd";
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
import { dump } from "js-yaml";
import defaultConfig from "../templates/default.yaml";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useImmerReducer } from "use-immer";

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
