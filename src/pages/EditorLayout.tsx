import React, {
  ChangeEvent,
  Dispatch,
  useContext,
  useEffect,
  useReducer,
  useState,
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
  configReducer,
} from "../components/context";
import { FormContext, RepertoireContext } from "../components/contants";
import { Config } from "../lib/config";
import { dump, load } from "js-yaml";
import {
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useImmerReducer } from "use-immer";
import { Uploader, exportFile } from "../components/Utils";
import { examples } from "../lib/example";
import { Compound, Form, Repertoire } from "../lib/data";
import { preprocessForm, preprocessRepertoire } from "../lib/utils";

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

const EditorLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [_, __, panel] = pathname.split("/");
  const config = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);
  const { source } = config;

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
            <Button
              onClick={() =>
                exportFile(dump(config, { flowLevel: 4 }), `export.yaml`)
              }
            >
              导出
            </Button>
            {source !== undefined && (
              <Button
                onClick={() => {
                  dispatch({
                    type: "load",
                    value: examples[source].self,
                  });
                }}
              >
                重置
              </Button>
            )}
          </Space>
        </Flex>
      </Layout.Header>
      <Outlet />
    </Layout>
  );
};

const _cache: Record<string, any> = {};
const fetchJson = async (filename: string) => {
  if (filename in _cache) {
    return _cache[filename];
  }
  const request = await fetch(`/cache/${filename}.json`);
  const json = await request.json();
  _cache[filename] = json;
  return json;
};

const Contextualized = () => {
  const { pathname } = useLocation();
  const [_, id] = pathname.split("/");
  const [config, dispatch] = useImmerReducer(configReducer, undefined, () => {
    return JSON.parse(localStorage.getItem(id)!) as Config;
  });
  const [repertoireAndForm, setRepertoire] = useState<[Repertoire, Form]>();
  useEffect(() => {
    Promise.all([fetchJson("repertoire"), fetchJson("form")]).then(
      ([repertoire, form]) => {
        setRepertoire([preprocessRepertoire(repertoire), preprocessForm(form)]);
      },
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(id, JSON.stringify(config));
  }, [config, id]);

  return (
    <>
      {repertoireAndForm !== undefined ? (
        <ConfigContext.Provider value={config}>
          <DispatchContext.Provider value={dispatch}>
            <RepertoireContext.Provider value={repertoireAndForm[0]}>
              <FormContext.Provider value={repertoireAndForm[1]}>
                <EditorLayout />
              </FormContext.Provider>
            </RepertoireContext.Provider>
          </DispatchContext.Provider>
        </ConfigContext.Provider>
      ) : (
        <h3>loading...</h3>
      )}
    </>
  );
};

export default Contextualized;
