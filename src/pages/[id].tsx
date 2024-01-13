import { Suspense, useState } from "react";
import { Button, Flex, Layout, Menu, Avatar, Tooltip, Empty } from "antd";
import DatabaseOutlined from "@ant-design/icons/DatabaseOutlined";
import MailOutlined from "@ant-design/icons/MailOutlined";
import SettingOutlined from "@ant-design/icons/SettingOutlined";
import ProfileOutlined from "@ant-design/icons/ProfileOutlined";
import BoldOutlined from "@ant-design/icons/BoldOutlined";
import OrderedListOutlined from "@ant-design/icons/OrderedListOutlined";
import RiseOutlined from "@ant-design/icons/RiseOutlined";

import type { MenuProps } from "antd";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import CusSpin from "~/components/CustomSpin";
import { DevTools } from "jotai-devtools";
import {
  configIdAtom,
  infoAtom,
  useSetAtom,
  useAtomValue,
  useAtom,
  fetchJson,
  repertoireAtom,
} from "~/atoms";
import { listToObject } from "~/lib/utils";

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
    label: "拆分",
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
    key: "repertoire",
    icon: <DatabaseOutlined />,
  },
  {
    label: "笔画分类",
    key: "classifier",
    icon: <DatabaseOutlined />,
  },
];

function EditorLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const relativePath = pathname.split("/").slice(2).join("/");
  const configInfo = useAtomValue(infoAtom);

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
          <div>{configInfo?.name ?? "未命名"}</div>
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

function LoadRepertoire() {
  const setRepertoire = useSetAtom(repertoireAtom);
  fetchJson("repertoire").then((value) => setRepertoire(listToObject(value)));
  return null;
}

export default function Contextualized() {
  const { pathname } = useLocation();
  const id = pathname.split("/")[1]!;

  if (!(id in localStorage)) {
    return <Empty description="无方案数据" />;
  }
  const [Id2, setId2] = useAtom(configIdAtom);
  setId2(id);
  if (!Id2) return null;

  return (
    <Suspense fallback={<CusSpin tip="加载JSON数据…" />}>
      <LoadRepertoire />
      <EditorLayout />
      <DevTools />
    </Suspense>
  );
}
