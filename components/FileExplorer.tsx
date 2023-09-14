import React, { useContext } from 'react';
import { AppstoreOutlined, MailOutlined, SettingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Menu } from 'antd';
import { DispatchContext } from './Context';
import { Config } from '../lib/chai';
import { Page } from './App';

type MenuItem = Required<MenuProps>['items'][number];

function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[],
  type?: 'group',
): MenuItem {
  return {
    key,
    icon,
    children,
    label,
    type,
  } as MenuItem;
}

const FileExplorer = ({ page, setPage }: { page: Page, setPage: (a: Page) => void}) => {
  const dispatch = useContext(DispatchContext);
  const configs = [] as Config[];
  const mapping = new Map<string, Config>();
  for (let i = 0; i != localStorage.length; ++i) {
    const key = localStorage.key(i)!;
    const raw = localStorage.getItem(key)!;
    const config = JSON.parse(raw);
    configs.push(config);
    mapping.set(key, config);
  }
  const items = configs.map(({ info }) => getItem(info.name, info.id, <SettingOutlined />));
  items.push(getItem('新建', '', <SettingOutlined />))
  const onClick: MenuProps['onClick'] = (e) => {
    if (e.key === '') {
      setPage("info");
    } else {
      dispatch({ type: "load", content: mapping.get(e.key)!})
      setPage("info");
    }
  };

  return (
    <Menu
      onClick={onClick}
      defaultSelectedKeys={['1']}
      defaultOpenKeys={['sub1']}
      mode="inline"
      items={items}
    />
  );
};

export default FileExplorer;