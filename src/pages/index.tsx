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
import type { Config, ExampleConfig, Info } from "~/lib";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { nanoid } from "nanoid";
import { type Updater, useImmer } from "use-immer";
import { type Example, examples } from "~/lib";
import { DeleteButton, Uploader } from "~/components/Utils";
import { load } from "js-yaml";
import Starter from "~/components/Starter";
import { useChaifenTitle, validateConfig } from "~/atoms";
import type { MenuProps } from "antd/lib";
import styled from "styled-components";
import Changelog from "~/components/changelog/ChangelogDrawer";
import User from "~/components/User";

const ListItem = ({
  id,
  info,
  setConfigs,
}: {
  id: string;
  info: Info;
  setConfigs: Updater<Record<string, Config>>;
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
          setConfigs((configs) => {
            delete configs[id];
            return configs;
          });
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
  const [configs, setConfigs] = useImmer(() =>
    Object.fromEntries(
      Object.entries(localStorage)
        .filter(([key]) => key.length === 9)
        .map(([key, value]) => {
          const data = JSON.parse(value) as Config;
          return [key, data];
        }),
    ),
  );

  const { snow, jdh, shouyou, xkjd, longma, bxm, mswb, ziyuan } = examples;
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
  const prepare = (x: ExampleConfig) => ({
    key: x.source!,
    label: x.info.name,
  });

  const items: MenuProps["items"] = [
    {
      key: "1",
      label: "音码",
      children: [snow, longma].map(prepare),
    },
    {
      key: "2",
      label: "音形",
      children: [jdh, shouyou, xkjd].map(prepare),
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
      .filter((x) => !configs[x] && x.length === 9)
      .forEach((id) => localStorage.removeItem(id));
  }, [configs]);

  const listData = Object.entries(configs).map(([id, { info }]) => ({
    id,
    setConfigs,
    info: info ?? {},
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
            footer={
              <Flex justify="center" gap="middle">
                <Starter setConfigs={setConfigs} />
                <Dropdown
                  placement="bottom"
                  menu={{
                    items,
                    onClick: (menu) => {
                      setConfigs((configs) => {
                        configs[nanoid(9)] = examples[menu.key as Example];
                      });
                    },
                  }}
                >
                  <Button>示例</Button>
                </Dropdown>
                <Uploader
                  type="yaml"
                  action={async (s) => {
                    const config = load(s) as Config;
                    const valid = await validateConfig(config);
                    // if (!valid) return;
                    setConfigs((configs) => {
                      configs[nanoid(9)] = load(s) as Config;
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
