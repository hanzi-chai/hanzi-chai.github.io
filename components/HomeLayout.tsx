import {
  Button,
  Dropdown,
  Flex,
  Form,
  Image,
  Input,
  Layout,
  List,
  Modal,
  Typography,
  notification,
} from "antd";
import { Config } from "../lib/config";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { useImmer } from "use-immer";
import { examples } from "../lib/example";
import { Select, Uploader } from "./Utils";
import { load } from "js-yaml";
import Starter from "./Starter";
import { post } from "../lib/api";
import { md5 } from "js-md5";

type Status = "login" | "signup" | "signin";

interface Controls {
  setStatus: (b: Status) => void;
}

interface Signin {
  id: string;
  password: string;
}

const SigninForm = ({ setStatus }: Controls) => {
  return (
    <Form<Signin>
      onFinish={async (value) => {
        const hashedValue = {
          username: value.id,
          password: md5.base64(value.password),
        };
        const response = await post<{ user: User; token: string }, any>(
          "login",
          hashedValue,
        );
        if ("err" in response) {
          notification.error({
            message: "无法登录",
            description: JSON.stringify(response),
          });
          return;
        }
        localStorage.setItem(".user", JSON.stringify(response.user));
        localStorage.setItem(".token", response.token);
        notification.success({
          message: "登录成功",
          description: "",
        });
        setStatus("login");
      }}
    >
      <Form.Item<Signin> name="id" label="用户名" required>
        <Input />
      </Form.Item>
      <Form.Item<Signin> name="password" label="密码" required>
        <Input.Password />
      </Form.Item>
      <Form.Item wrapperCol={{ offset: 10, span: 4 }}>
        <Button type="primary" htmlType="submit">
          提交
        </Button>
      </Form.Item>
    </Form>
  );
};

interface Signup extends Signin {
  name: string;
  email: string;
}

interface User extends Signup {
  avatar: string;
  role: 0 | 1 | 2;
  status: 0 | 1;
}

const SignupForm = ({ setStatus }: Controls) => {
  return (
    <Form<Signup>
      onFinish={async (value) => {
        const hashedValue = { ...value, password: md5.base64(value.password) };
        const response = await post<true, Signup>("users", hashedValue);
        if (typeof response !== "boolean") {
          notification.error({
            message: "无法注册",
            description: JSON.stringify(response),
          });
          return;
        }
        notification.success({
          message: "注册成功",
          description: "现在请您登录",
        });
        setStatus("signin");
      }}
    >
      <Form.Item<Signup> name="id" label="用户名" required>
        <Input />
      </Form.Item>
      <Form.Item<Signup> name="name" label="昵称" required>
        <Input />
      </Form.Item>
      <Form.Item<Signup> name="email" label="邮箱" required>
        <Input />
      </Form.Item>
      <Form.Item<Signup> name="password" label="密码" required>
        <Input.Password />
      </Form.Item>
      <Form.Item wrapperCol={{ offset: 10, span: 4 }}>
        <Button type="primary" htmlType="submit">
          提交
        </Button>
      </Form.Item>
    </Form>
  );
};

const UserInfo = () => {
  const user = JSON.parse(localStorage.getItem(".user")!) as User;
  return <Typography.Text>欢迎回来，{user.name}</Typography.Text>;
};

const HomeLayout = () => {
  const [configs, setConfigs] = useImmer(() =>
    Object.fromEntries(
      Object.entries(localStorage)
        .filter(([key]) => !key.startsWith("."))
        .map(([key, value]) => {
          const data = JSON.parse(value) as Config;
          return [key, data];
        }),
    ),
  );
  const [status, setStatus] = useState<Status>(() => {
    return localStorage.getItem(".user") ? "login" : "signin";
  });

  useEffect(() => {
    Object.entries(configs).forEach(([id, config]) => {
      localStorage.setItem(id, JSON.stringify(config));
    });
    Object.keys(localStorage)
      .filter((x) => !configs[x] && !x.startsWith("."))
      .forEach((id) => localStorage.removeItem(id));
  }, [configs]);

  return (
    <Layout style={{ height: "100%" }}>
      <Layout.Sider width={320} theme="light">
        <Flex
          vertical
          justify="space-evenly"
          style={{ height: "100%", padding: "0 32px" }}
        >
          <List
            itemLayout="horizontal"
            dataSource={Object.entries(configs)}
            renderItem={([id, { info }]) => {
              return (
                <List.Item
                  actions={[
                    <Link to={id}>编辑</Link>,
                    <a
                      onClick={() =>
                        setConfigs((configs) => {
                          delete configs[id];
                        })
                      }
                    >
                      删除
                    </a>,
                  ]}
                >
                  <List.Item.Meta
                    title={info.name}
                    description={info.description}
                  />
                </List.Item>
              );
            }}
          />
          <Flex justify="center" gap="middle">
            <Starter setConfigs={setConfigs} />
            <Dropdown
              placement="bottom"
              menu={{
                items: Object.values(examples),
                onClick: (menu) => {
                  setConfigs((configs) => {
                    configs[uuid()] = examples[menu.key].self;
                  });
                },
              }}
            >
              <Button>示例</Button>
            </Dropdown>
            <Uploader
              action={(s) => {
                setConfigs((configs) => {
                  configs[uuid()] = load(s) as Config;
                });
              }}
            />
          </Flex>
        </Flex>
      </Layout.Sider>
      <Flex
        component={Layout.Content}
        vertical
        justify="center"
        align="center"
        gap="large"
        style={{ padding: "32px" }}
      >
        <Image alt="favicon" src="/favicon.ico" />
        <Typography.Title>汉字自动拆分系统 v{APP_VERSION}</Typography.Title>
        <Typography.Text>
          © 汉字自动拆分开发团队 2019 - {new Date().getFullYear()}
        </Typography.Text>
      </Flex>
      <Layout.Sider width={320} theme="light">
        <Flex
          vertical
          justify="space-evenly"
          style={{ height: "100%", padding: "0 32px" }}
        >
          <Flex justify="center" gap="middle">
            <Button
              type="primary"
              disabled={status === "login"}
              onClick={() => {
                setStatus("signin");
              }}
            >
              登录
            </Button>
            <Button
              disabled={status !== "login"}
              onClick={() => {
                setStatus("signin");
                localStorage.removeItem(".user");
                localStorage.removeItem(".token");
              }}
            >
              退出
            </Button>
            <Button
              type="default"
              disabled={status === "login"}
              onClick={() => {
                setStatus("signup");
              }}
            >
              注册
            </Button>
          </Flex>
          {status === "signin" && <SigninForm setStatus={setStatus} />}
          {status === "signup" && <SignupForm setStatus={setStatus} />}
          {status === "login" && <UserInfo />}
        </Flex>
      </Layout.Sider>
    </Layout>
  );
};

export default HomeLayout;
