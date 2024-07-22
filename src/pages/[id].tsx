import { Suspense, useEffect, useState } from "react";
import { Button, Flex, Layout, Menu, Avatar, Tooltip, Empty } from "antd";
import DatabaseOutlined from "@ant-design/icons/DatabaseOutlined";
import MailOutlined from "@ant-design/icons/MailOutlined";
import SettingOutlined from "@ant-design/icons/SettingOutlined";
import ProfileOutlined from "@ant-design/icons/ProfileOutlined";
import BoldOutlined from "@ant-design/icons/BoldOutlined";
import OrderedListOutlined from "@ant-design/icons/OrderedListOutlined";
import RiseOutlined from "@ant-design/icons/RiseOutlined";
import NumberOutlined from "@ant-design/icons/NumberOutlined";

import type { MenuProps } from "antd";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import CusSpin from "~/components/CustomSpin";
import {
  infoAtom,
  useSetAtom,
  useAtomValue,
  fetchAsset,
  primitiveRepertoireAtom,
  useAtom,
  syncConfig,
  syncAssets,
  syncInfo,
} from "~/atoms";
import { examples, listToObject } from "~/lib";

const items: MenuProps["items"] = [
  {
    label: "基本",
    key: "",
    icon: <MailOutlined />,
  },
  {
    label: "数据",
    key: "repertoire",
    icon: <DatabaseOutlined />,
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
    label: "编码",
    key: "assembly",
    icon: <OrderedListOutlined />,
  },
  {
    label: "校对",
    key: "debug",
    icon: <BoldOutlined />,
  },
  {
    label: "统计一",
    key: "statistics",
    icon: <NumberOutlined />,
  },
  {
    label: "统计二",
    key: "statistics2",
    icon: <NumberOutlined />,
  },
  {
    label: "优化",
    key: "optimization",
    icon: <RiseOutlined />,
  },
];

const Header = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const info = useAtomValue(infoAtom);
  return (
    <Layout.Header style={{ paddingLeft: isCollapsed ? "68px" : "170px" }}>
      <div>{info?.name ?? "未命名"}</div>
    </Layout.Header>
  );
};

function EditorLayout() {
  useAtom(syncConfig);
  useAtom(syncAssets);
  useAtom(syncInfo);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const relativePath = pathname.split("/").slice(2).join("/");

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
                type="text"
                style={{
                  height: isCollapsed ? "48px" : "64px",
                  margin: "8px 0",
                  color: "#999",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Avatar
                  shape="square"
                  src="/icon.webp"
                  style={{ flexShrink: 0 }}
                />
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
        <Header isCollapsed={isCollapsed} />
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

export default function Contextualized() {
  let id = "";
  // cloudflare 平台是 history 模式的 router,但 PAGES 是 hash 模式的 router
  // 要区别对待
  if (import.meta.env.MODE === "CF") {
    id = location.pathname.split("/")[1] ?? "";
  } else {
    id = location.hash.split("/")[1] ?? "";
  }
  const setRepertoire = useSetAtom(primitiveRepertoireAtom);

  useEffect(() => {
    fetchAsset("repertoire").then((value) =>
      setRepertoire(listToObject(value)),
    );
  }, [setRepertoire]);

  if (!(id in localStorage || id in examples)) {
    return <Empty description="无方案数据" />;
  }

  return (
    <Suspense fallback={<CusSpin tip="加载JSON数据…" />}>
      <EditorLayout />
    </Suspense>
  );
}
