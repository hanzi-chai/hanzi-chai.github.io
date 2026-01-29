import {
  Badge,
  Button,
  Dropdown,
  Flex,
  Image,
  Layout,
  List,
  Tag,
  Typography,
} from "antd";
import type { MenuProps } from "antd/lib";
import { load } from "js-yaml";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import styled from "styled-components";
import Changelog from "~/components/changelog/ChangelogDrawer";
import Starter from "~/components/Starter";
import User from "~/components/User";
import { DeleteButton, Uploader } from "~/components/Utils";
import type { 基本信息, 示例配置, 配置 } from "~/lib";
import { type Example, examples } from "~/templates";
import { useChaifenTitle, validateConfig } from "~/utils";

const ListItem = ({
  id,
  info,
  removeConfig,
}: {
  id: string;
  info: 基本信息;
  removeConfig: (id: string) => void;
}) => {
  return (
    <Flex align="center" justify="space-between" style={{ width: "100%" }}>
      <StyledListItem
        to={`/${id}`}
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <Typography.Title level={5} style={{ margin: 0 }}>
          {info.name + (info.version ? ` (${info.version})` : "")}
        </Typography.Title>
        <Typography.Text>{info.description}</Typography.Text>
      </StyledListItem>
      <DeleteButton
        onClick={(e) => {
          e.stopPropagation();
          removeConfig(id);
        }}
      />
    </Flex>
  );
};

const StyledListItem = styled(Link)`
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  flex: 1;

  &:hover {
    background-color: #f5f5f5;
    transition: background-color 0.3s;
  }
`;

export default function HomeLayout() {
  useChaifenTitle("首页");
  const isSchema = (key: string) => key.length === 9;
  const [configs, setConfigs] = useState(() =>
    Object.fromEntries(
      Object.entries(localStorage)
        .filter(([key]) => isSchema(key))
        .map(([key, value]) => {
          const data = JSON.parse(value) as 配置;
          return [key, data];
        }),
    ),
  );

  const { snow4, jdh, shouyou, xkjd, cqkm, longma, bxm, mswb, ziyuan } =
    examples;
  const {
    easy,
    huma,
    sapphire,
    tianma,
    xuma,
    yustar,
    yujoy,
    zhangma,
    zhengma,
    zhenma,
  } = examples;
  const prepare = (x: 示例配置) => ({
    key: x.source!,
    label: x.info.name,
  });

  const items: MenuProps["items"] = [
    {
      key: "1",
      label: "音码",
      children: [snow4, longma].map(prepare),
    },
    {
      key: "2",
      label: "音形",
      children: [jdh, shouyou, xkjd, cqkm].map(prepare),
    },
    {
      key: "3",
      label: "形音",
      children: [bxm, mswb, ziyuan].map(prepare),
    },
    {
      key: "4",
      label: "形码",
      children: [
        easy,
        huma,
        sapphire,
        tianma,
        xuma,
        yustar,
        yujoy,
        zhangma,
        zhengma,
        zhenma,
      ].map(prepare),
    },
  ];

  useEffect(() => {
    Object.entries(configs).forEach(([id, config]) => {
      localStorage.setItem(id, JSON.stringify(config));
    });
    Object.keys(localStorage)
      .filter((x) => !configs[x] && isSchema(x))
      .map((id) => localStorage.removeItem(id));
  }, [configs]);

  const listData = Object.entries(configs).map(([id, { info }]) => ({
    id,
    info: info ?? {},
    removeConfig: (id: string) => {
      setConfigs((configs) => {
        const newConfigs = { ...configs };
        delete newConfigs[id];
        return newConfigs;
      });
    },
  }));

  return (
    <Layout style={{ height: "100%" }}>
      <Layout.Sider width={320} theme="light">
        <Flex
          vertical
          justify="space-evenly"
          style={{ height: "100%", padding: "0 1.5rem" }}
        >
          <List
            dataSource={listData}
            renderItem={ListItem}
            header={"方案管理"}
            footer={
              <Flex justify="center" gap="middle">
                <Starter
                  addConfig={(id, config) =>
                    setConfigs({ ...configs, [id]: config })
                  }
                />
                <Dropdown
                  placement="bottom"
                  menu={{
                    items,
                    onClick: (menu) => {
                      setConfigs({
                        ...configs,
                        [nanoid(9)]: examples[menu.key as Example],
                      });
                    },
                  }}
                >
                  <Button>示例</Button>
                </Dropdown>
                <Uploader
                  action={async (s) => {
                    const config = load(s) as 配置;
                    const valid = await validateConfig(config);
                    if (!valid) return;
                    setConfigs({
                      ...configs,
                      [nanoid(9)]: config,
                    });
                  }}
                />
              </Flex>
            }
          />
        </Flex>
      </Layout.Sider>
      <Flex
        component={Layout.Content}
        vertical
        justify="center"
        align="center"
        gap="large"
      >
        <Image
          wrapperStyle={{ maxWidth: "50vh" }}
          alt="favicon"
          src="/icon.webp"
        />
        <Typography.Title style={{ margin: 0 }}>
          汉字自动拆分系统
        </Typography.Title>
        <Flex>
          <Tag>v{APP_VERSION}</Tag>
          <Changelog />
        </Flex>
        <User />
        <Typography.Text>
          © 汉字自动拆分开发团队 2019 - {new Date().getFullYear()}
        </Typography.Text>
      </Flex>
    </Layout>
  );
}
