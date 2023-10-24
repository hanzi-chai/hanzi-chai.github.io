import { Layout, Menu, MenuProps } from "antd";
import {
  BorderOutlined,
  AppstoreOutlined,
  InfoCircleOutlined,
  MenuOutlined,
  NumberOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const items: MenuProps["items"] = [
  {
    label: "字形",
    key: "form",
    icon: <BorderOutlined />,
  },
  {
    label: "字音及字集",
    key: "repertoire",
    icon: <InfoCircleOutlined />,
  },
  {
    label: "笔画分类",
    key: "classifier",
    icon: <NumberOutlined />,
  },
];

export default function Data() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mode = pathname.split("/")[3];
  return (
    <Layout style={{ flex: 1 }}>
      <Layout.Sider theme="light">
        <Menu
          items={items}
          selectedKeys={[mode]}
          onClick={(e) => {
            navigate(e.key);
          }}
        />
      </Layout.Sider>
      <div style={{ padding: "32px", height: "100%", flex: 1 }}>
        <Outlet />
      </div>
    </Layout>
  );
}
