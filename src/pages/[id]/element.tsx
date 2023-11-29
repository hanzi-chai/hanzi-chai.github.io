import { Layout, Menu } from "antd";
import { Outlet, useNavigate } from "react-router-dom";
import { useConfigType } from "~/components/context";

export const formElementTypes = ["字根", "笔画", "二笔"] as const;
export type FormElementTypes = (typeof formElementTypes)[number];

export default function Elements() {
  const navigate = useNavigate();
  const index = useConfigType();
  return (
    <Layout style={{ flex: 1, display: "flex" }}>
      <Layout.Sider theme="light">
        <Menu
          items={[
            { key: "form", label: "字形" },
            { key: "pronunciation", label: "字音" },
          ]}
          selectedKeys={[index.toString()]}
          onClick={(e) => {
            navigate(e.key);
          }}
        />
      </Layout.Sider>
      <div style={{ padding: "0 32px", height: "100%", flexGrow: 1 }}>
        <Outlet />
      </div>
    </Layout>
  );
}
