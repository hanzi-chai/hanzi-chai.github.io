import { useContext, useEffect, Suspense, useState } from "react";
import { Button, Flex, Layout, Menu, Avatar, Tooltip, Empty } from "antd";
import DatabaseOutlined from "@ant-design/icons/DatabaseOutlined";
import MailOutlined from "@ant-design/icons/MailOutlined";
import SettingOutlined from "@ant-design/icons/SettingOutlined";
import ProfileOutlined from "@ant-design/icons/ProfileOutlined";
import BoldOutlined from "@ant-design/icons/BoldOutlined";
import OrderedListOutlined from "@ant-design/icons/OrderedListOutlined";
import RiseOutlined from "@ant-design/icons/RiseOutlined";

import type { MenuProps } from "antd";
import {
  ConfigContext,
  DispatchContext,
  configReducer,
} from "~/components/context";
import type { Config } from "~/lib/config";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useImmerReducer } from "use-immer";
import { listToObject } from "~/lib/utils";
import CusSpin from "~/components/CustomSpin";
import {
  loadForm,
  loadRepertoire,
  selectFormLoading,
  useAppDispatch,
  useAppSelector,
} from "~/components/store";
import { configIdAtom, configAtom } from "~/atoms/main";
import { useAtom } from "jotai";

const items: MenuProps["items"] = [
  {
    label: "基本",
    key: "",
    icon: <MailOutlined />,
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
    label: "取码",
    key: "assembly",
    icon: <OrderedListOutlined />,
  },
  {
    label: "编码",
    key: "encode",
    icon: <BoldOutlined />,
  },
  {
    label: "优化",
    key: "optimization",
    icon: <RiseOutlined />,
  },
  {
    label: "数据",
    key: "data",
    icon: <DatabaseOutlined />,
    children: [
      {
        label: "字形数据",
        key: "data/form",
      },
      {
        label: "字音字集",
        key: "data/repertoire",
      },
      {
        label: "笔画分类",
        key: "data/classifier",
      },
    ],
  },
];

function EditorLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const relativePath = pathname.split("/").slice(2).join("/");

  const config = useContext(ConfigContext);
  const [isCollapsed, setCollapsed] = useState(false);
  return (
    <Layout hasSider>
      <Layout.Sider
        style={{
          overflow: "auto",
          height: "100vh",
          position: "fixed",
          zIndex: "999",
          left: 0,
          top: 0,
          bottom: 0,
        }}
        breakpoint="md"
        collapsible
        collapsedWidth={58}
        onCollapse={(v) => setCollapsed(v)}
        width={160}
      >
        <Flex vertical>
          <Tooltip
            title="返回首页"
            placement={isCollapsed ? "right" : "bottom"}
            color="rgb(196,144,84)"
          >
            <Link to="/">
              <Button
                block
                type="text"
                style={{
                  height: isCollapsed ? "48px" : "64px",
                  margin: "8px 0",
                  color: "#999",
                }}
              >
                <Avatar shape="square" src="/icon.webp" />
                <br />
                {isCollapsed ? null : (
                  <div
                    style={{
                      marginTop: "2px",
                      letterSpacing: "1px",
                      fontSize: "12px",
                    }}
                  >
                    汉字自动拆分系统
                  </div>
                )}
              </Button>
            </Link>
          </Tooltip>
          <Menu
            theme="dark"
            mode="inline"
            items={items}
            selectedKeys={[relativePath]}
            defaultOpenKeys={["data", "element"]}
            onClick={(e) => navigate(e.key)}
          />
        </Flex>
      </Layout.Sider>
      <Layout style={{ height: "100vh" }}>
        <Layout.Header style={{ paddingLeft: isCollapsed ? "68px" : "170px" }}>
          <div>{config.info?.name ?? "未命名"}</div>
        </Layout.Header>
        <Layout.Content
          style={{
            marginLeft: isCollapsed ? "58px" : "160px",
            padding: "10px 24px",
          }}
        >
          <Flex justify="center" style={{ height: "100%" }}>
            <div
              style={{
                maxWidth: "100rem",
                minWidth: "20rem",
                width: "100rem",
                overflowY: "auto",
              }}
            >
              <Suspense fallback={<CusSpin tip="加载标签页…" />}>
                <Outlet />
              </Suspense>
            </div>
          </Flex>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

const _cache: Record<string, any> = {};
async function fetchJson(filename: string) {
  if (filename in _cache) {
    return _cache[filename];
  }
  const request = await fetch(`/cache/${filename}.json`);
  const json = await request.json();
  _cache[filename] = json;
  return json;
}

export default function Contextualized() {
  const { pathname } = useLocation();
  const [_, id] = pathname.split("/");
  const [config, dispatch] = useImmerReducer(configReducer, undefined, () => {
    return JSON.parse(localStorage.getItem(id!)!) as Config;
  });
  const appdispatch = useAppDispatch();
  const loading = useAppSelector(selectFormLoading);
  const [id2, setid2] = useAtom(configIdAtom);
  setid2(id!);
  const [conf, setconf] = useAtom(configAtom);
  console.log(conf);

  useEffect(() => {
    Promise.all([fetchJson("repertoire"), fetchJson("form")]).then(
      ([repertoire, form]) => {
        appdispatch(loadForm(listToObject(form)));
        appdispatch(loadRepertoire(listToObject(repertoire)));
      },
    );
  }, []);

  useEffect(() => {
    if (config) {
      localStorage.setItem(id!, JSON.stringify(config));
    }
  }, [config, id]);

  if (!config) return <Empty description="无方案数据" />;
  if (loading) return <CusSpin tip="加载JSON数据…" />;
  return (
    <ConfigContext.Provider value={config}>
      <DispatchContext.Provider value={dispatch}>
        <div style={{ textAlign: "right" }}>{id2}</div>
        <EditorLayout />
      </DispatchContext.Provider>
    </ConfigContext.Provider>
  );
}
