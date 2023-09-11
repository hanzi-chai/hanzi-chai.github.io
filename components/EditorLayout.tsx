import { Dispatch, PropsWithChildren, useContext } from "react";
import { Button, Menu } from "antd";
import { AppstoreOutlined, MailOutlined, SettingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { ConfigContext, DispatchContext } from "./Context";
import { Config } from "../lib/chai";
import { Page } from "./App"

const items: MenuProps['items'] = [
  {
    label: '基本',
    key: "info",
    icon: <MailOutlined />,
  },
  {
    label: '数据',
    key: "data",
    icon: <AppstoreOutlined />,
  },
  {
    label: '规则',
    key: "rule",
    icon: <SettingOutlined />,
  },
  {
    label: '字根',
    key: "root",
    icon: <SettingOutlined />,
  },
  {
    label: '拆分',
    key: "result",
    icon: <SettingOutlined />,
  },
];

const exportFile = (config: Config) => {
  const fileContent = JSON.stringify(config);
  const blob = new Blob([fileContent], { type: 'text/plain' });
  const a = document.createElement('a');
  a.download = `${config.info.id}.json`;
  a.href = window.URL.createObjectURL(blob);
  a.click();
}

export default function EditorLayout({ children, page, setPage }: PropsWithChildren<{ page: string, setPage: (a: Page) => void }>) {
  const config = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);
  return (
    <>
      <header style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <div onClick={() => {
          localStorage.setItem(config.info.id, JSON.stringify(config));
          setPage("home");
        }}>
          <h1>{ config.info.name }</h1>
        </div>
        <nav>
          <Menu onClick={e => setPage(e.key as Page)} selectedKeys={[page]} mode="horizontal" items={items} />
        </nav>
        <div style={{display: "flex"}}>
          <Button onClick={() => document.getElementById('import')!.click()}>
            导入
            <input type="file" id="import" hidden onChange={(e) => {
                const [file] = e.target.files!;
                const reader = new FileReader();
                reader.addEventListener('load', () => dispatch({ type: "load", content: JSON.parse(reader.result as string)}))
                reader.readAsText(file);
              }
            }/>
          </Button>
          <Button onClick={() => exportFile(config)}>导出</Button>
        </div>
      </header>
      {children}
    </>
  );
}
