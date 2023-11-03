import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createGlobalStyle } from "styled-components";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router-dom";
import { ConfigProvider } from "antd";
import { get } from "./lib/api";
import { Provider } from "react-redux";
import { store } from "./components/store";
import AutoRoute from "~react-pages";

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

const legacyLoader = async () => {
  const repertoire = get<Record<string, any>, undefined>("repertoire");
  const form = get<Record<string, any>, undefined>("form/all");
  const data = await Promise.all([repertoire, form]);
  return data;
};

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
        <RouterProvider router={router} />
      </Provider>
    </ConfigProvider>
  </StrictMode>,
);
