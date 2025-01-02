import { Button, Flex, Typography, notification } from "antd";
import { post } from "~/api";
import { md5 } from "js-md5";
import { ModalForm, ProFormText } from "@ant-design/pro-components";

interface Signin {
  id: string;
  password: string;
}

const SigninForm = () => {
  return (
    <ModalForm<Signin>
      trigger={<Button type="primary">登录</Button>}
      title="登录"
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
        localStorage.setItem("user", JSON.stringify(response.user));
        localStorage.setItem("token", response.token);
        notification.success({
          message: "登录成功",
          description: "",
        });
        window.location.reload();
      }}
    >
      <ProFormText name="id" label="用户名" required />
      <ProFormText.Password name="password" label="密码" required />
    </ModalForm>
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

const SignupForm = () => {
  return (
    <ModalForm<Signup>
      trigger={<Button>注册</Button>}
      title="注册"
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
        window.location.reload();
      }}
    >
      <ProFormText name="id" label="用户名" required />
      <ProFormText name="name" label="昵称" required />
      <ProFormText name="email" label="邮箱" required />
      <ProFormText.Password name="password" label="密码" required />
    </ModalForm>
  );
};

export const getUser = () => {
  return localStorage.getItem("user")
    ? (JSON.parse(localStorage.getItem("user")!) as User)
    : undefined;
};

export default function User() {
  const user = getUser();
  return user === undefined ? (
    <Flex justify="center" gap="middle">
      <SignupForm />
      <SigninForm />
    </Flex>
  ) : (
    <Flex justify="center" gap="middle" align="baseline">
      <Typography.Text>当前用户：{user.name}</Typography.Text>
      <Button
        onClick={() => {
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          window.location.reload();
        }}
      >
        退出
      </Button>
    </Flex>
  );
}
