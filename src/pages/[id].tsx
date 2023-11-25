import React, { useContext, useEffect, Suspense } from "react";
import { Button, Flex, Layout, Menu, Space, Typography } from "antd";
import DatabaseOutlined from "@ant-design/icons/DatabaseOutlined";
import MailOutlined from "@ant-design/icons/MailOutlined";
import SettingOutlined from "@ant-design/icons/SettingOutlined";
import ProfileOutlined from "@ant-design/icons/ProfileOutlined";
import BoldOutlined from "@ant-design/icons/BoldOutlined";
import CaretLeftFilled from "@ant-design/icons/CaretLeftFilled";
import type { MenuProps } from "antd";
import {
  ConfigContext,
  DispatchContext,
  configReducer,
} from "~/components/context";
import type { Config } from "~/lib/config";
import { load } from "js-yaml";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useImmerReducer } from "use-immer";
import { Uploader, exportYAML } from "~/components/Utils";
import { examples } from "~/lib/example";
import { listToObject } from "~/lib/utils";
import CusSpin from "~/components/CustomSpin";
import {
  loadForm,
  loadRepertoire,
  selectFormLoading,
  useAppDispatch,
  useAppSelector,
} from "~/components/store";

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
            <Button onClick={() => exportYAML(config, `export.yaml`)}>
              导出
            </Button>
            {source && (
              <Button
                onClick={() => {
                  dispatch({
                    type: "load",
                    value: examples[source],
                  });
                }}
              >
                重置
              </Button>
            )}
          </Space>
        </Flex>
      </Layout.Header>
      <Suspense fallback={<CusSpin tip="加载标签页…" />}>
        <Outlet />
      </Suspense>
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
    return JSON.parse(localStorage.getItem(id!)!) as Config;
  });
  const appdispatch = useAppDispatch();
  const loading = useAppSelector(selectFormLoading);
  useEffect(() => {
    Promise.all([fetchJson("repertoire"), fetchJson("form")]).then(
      ([repertoire, form]) => {
        appdispatch(loadForm(listToObject(form)));
        appdispatch(loadRepertoire(listToObject(repertoire)));
      },
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(id!, JSON.stringify(config));
  }, [config, id]);

  return loading ? (
    <CusSpin tip="加载JSON数据…" />
  ) : (
    <ConfigContext.Provider value={config}>
      <DispatchContext.Provider value={dispatch}>
        <EditorLayout />
      </DispatchContext.Provider>
    </ConfigContext.Provider>
  );
};

export default Contextualized;
