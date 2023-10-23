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
  ConfigContext,
  DispatchContext,
  FormContext,
  RepertoireContext,
  configReducer,
} from "./context";
import { Config } from "../lib/config";
import { Action } from "./context";
import { dump, load } from "js-yaml";
import {
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useImmerReducer } from "use-immer";
import { Uploader } from "./Utils";
import { templates } from "../lib/template";
import { Form, Repertoire } from "../lib/data";

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
  data: "/form",
  element: "/form",
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
  const data = useLoaderData() as [any[], any[]];
  const repertoire: Repertoire = Object.fromEntries(
    data[0].map((x) => [
      String.fromCodePoint(x.unicode),
      {
        tygf: x.tygf,
        gb2312: x.gb2312,
        pinyin: JSON.parse(x.pinyin),
      },
    ]),
  );
  const form: Form = Object.fromEntries(
    data[1].map((x) => [
      String.fromCodePoint(x.unicode),
      {
        name: x.name,
        default_type: x.default_type,
        gf0014_id: x.gf0014_id,
        component: x.component && JSON.parse(x.component),
        compound: x.compound && JSON.parse(x.compound),
        slice: x.slice && JSON.parse(x.slice),
      },
    ]),
  );

  useEffect(() => {
    localStorage.setItem(id, JSON.stringify(config));
  }, [config, id]);

  return (
    <ConfigContext.Provider value={config}>
      <DispatchContext.Provider value={dispatch}>
        <RepertoireContext.Provider value={repertoire}>
          <FormContext.Provider value={form}>
            <EditorLayout />
          </FormContext.Provider>
        </RepertoireContext.Provider>
      </DispatchContext.Provider>
    </ConfigContext.Provider>
  );
};

export default Contextualized;
