import React, { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createGlobalStyle } from "styled-components";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router-dom";
import { ConfigProvider } from "antd";
import { Provider } from "react-redux";
import { store } from "./components/store";
import CusSpin from "~/components/CustomSpin";
import Error from "./components/Error";
import AutoRoute from "~react-pages";

const idpath = AutoRoute.find((v) => v.path === ":id");
idpath?.children?.forEach((v) => {
  if (v.path === "analysis" || v.path === "element") {
    v.errorElement = <Error />;
  }
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
    <ConfigProvider autoInsertSpaceInButton={false}>
      <Provider store={store}>
        <Suspense fallback={<CusSpin tip="加载APP…" />}>
          <RouterProvider router={router} />
        </Suspense>
      </Provider>
    </ConfigProvider>
  </StrictMode>,
);
