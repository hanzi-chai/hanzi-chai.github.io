import { AppstoreOutlined } from "@ant-design/icons";
import BoldOutlined from "@ant-design/icons/BoldOutlined";
import DatabaseOutlined from "@ant-design/icons/DatabaseOutlined";
import MailOutlined from "@ant-design/icons/MailOutlined";
import NumberOutlined from "@ant-design/icons/NumberOutlined";
import OrderedListOutlined from "@ant-design/icons/OrderedListOutlined";
import ProfileOutlined from "@ant-design/icons/ProfileOutlined";
import RiseOutlined from "@ant-design/icons/RiseOutlined";
import SettingOutlined from "@ant-design/icons/SettingOutlined";
import type { MenuProps } from "antd";
import {
  Avatar,
  Empty,
  Flex,
  Layout,
  Menu,
  Skeleton,
  Tooltip,
  Typography,
} from "antd";
import { Suspense, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useAtomValue, 基本信息原子 } from "~/atoms";
import ConfigManager from "~/components/ConfigManager";
import { isDataReady, 预加载 } from "~/preload";
import { examples } from "~/templates";
import { getCurrentId } from "~/utils";

const items: MenuProps["items"] = [
  { label: "基本", key: "", icon: <MailOutlined /> },
  { label: "数据", key: "repertoire", icon: <DatabaseOutlined /> },
  { label: "元素", key: "element", icon: <SettingOutlined /> },
  { label: "拆分", key: "analysis", icon: <AppstoreOutlined /> },
  { label: "编码", key: "assembly", icon: <OrderedListOutlined /> },
  { label: "校对", key: "debug", icon: <BoldOutlined /> },
  { label: "统计一", key: "statistics", icon: <NumberOutlined /> },
  { label: "统计二", key: "statistics2", icon: <NumberOutlined /> },
  { label: "优化", key: "optimization", icon: <RiseOutlined /> },
  { label: "图示", key: "diagram", icon: <ProfileOutlined /> },
];

const Header = ({ isCollapsed: _ }: { isCollapsed: boolean }) => {
  const info = useAtomValue(基本信息原子);
  return (
    <Layout.Header className={`h-12! place-content-center! px-8!`}>
      <Flex justify="space-between" align="center">
        <Typography.Title level={2} className="m-0! font-normal! text-xl!">
          {info?.name ?? "未命名"}
        </Typography.Title>
        <ConfigManager />
      </Flex>
    </Layout.Header>
  );
};

let _preloadPromise: Promise<void> | null = null;

export function PreloadGuard({ children }: { children: React.ReactNode }) {
  if (!isDataReady()) {
    _preloadPromise ??= 预加载();
    throw _preloadPromise;
  }
  return <>{children}</>;
}

export default function EditorLayout() {
  const id = getCurrentId();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const relativePath = pathname.split("/").slice(2).join("/");
  const [isCollapsed, setCollapsed] = useState(false);

  if (!(id in localStorage || id in examples)) {
    return <Empty description="无方案数据" />;
  }

  return (
    <Layout hasSider>
      <Layout.Sider
        className="overflow-auto h-screen fixed z-999 left-0 top-0 bottom-0"
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
            <Link
              to="/"
              className={`flex flex-col items-center w-full py-4!`}
            >
              <Avatar shape="square" src="/icon.webp" className={`${isCollapsed ? "h-8! w-8!" : "h-12! w-12!"} shrink-0`} />
              {isCollapsed ? null : (
                <div className="mt-4 tracking-[1px] text-[#999]!">
                  汉字自动拆分系统
                </div>
              )}
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
      <Layout className="h-screen">
        <Header isCollapsed={isCollapsed} />
        <Layout.Content className={`py-2.5 px-6 h-full overflow-y-auto`}>
          <Suspense fallback={<Skeleton active />}>
            <PreloadGuard>
              <Outlet />
            </PreloadGuard>
          </Suspense>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
