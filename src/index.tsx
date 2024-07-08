import React, { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createGlobalStyle } from "styled-components";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router-dom";
import { ConfigProvider } from "antd";
import CusSpin from "~/components/CustomSpin";
import Error from "./components/Error";
import AutoRoute from "~react-pages";

import "./index.css";

const idpath = AutoRoute.find((v) => v.path === ":id");
idpath?.children?.forEach((v) => {
  v.errorElement = <Error />;
});

const GlobalStyle = createGlobalStyle`
  html {
    font-size: 14px;
  }
  body {
    margin: 0;
  }
  html, body, #root {
    height: 100%;
  }
`;

const createRouter =
  import.meta.env.MODE === "BEX" || import.meta.env.MODE === "PAGES"
    ? createHashRouter
    : createBrowserRouter;

const router = createRouter(AutoRoute);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalStyle />
    <ConfigProvider
      button={{ autoInsertSpace: false }}
      theme={{
        components: {
          Layout: {
            headerHeight: 32,
            headerBg: "#d9d9d9",
          },
        },
      }}
    >
      <Suspense fallback={<CusSpin tip="加载APP…" />}>
        <RouterProvider router={router} />
      </Suspense>
    </ConfigProvider>
  </StrictMode>,
);
