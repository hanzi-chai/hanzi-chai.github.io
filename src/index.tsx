import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createGlobalStyle } from "styled-components";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router-dom";
import HomeLayout from "./pages/HomeLayout";
import EditorLayout from "./pages/EditorLayout";
import Info from "./pages/Info";
import Data from "./pages/Data";
import Elements, {
  PhoneticElementConfig,
  RootElementConfig,
} from "./pages/Elements";
import Analysis from "./pages/Analysis";
import Encoder from "./pages/Encoder";
import Classifier from "./pages/Classifier";
import { ConfigProvider } from "antd";
import Repertoire from "./pages/Repertoire";
import Form from "./pages/Form";
import { get } from "./lib/api";

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
  import.meta.env.MODE === "CF" ? createBrowserRouter : createHashRouter;
const router = createRouter([
  {
    path: "/",
    element: <HomeLayout />,
  },
  {
    path: "/:id",
    element: <EditorLayout />,
    children: [
      { index: true, element: <Info /> },
      {
        path: "data",
        element: <Data />,
        children: [
          { path: "form", element: <Form /> },
          { path: "repertoire", element: <Repertoire /> },
          { path: "classifier", element: <Classifier /> },
        ],
      },
      {
        path: "element",
        element: <Elements />,
        children: [
          { path: "form", element: <RootElementConfig /> },
          { path: "pronunciation", element: <PhoneticElementConfig /> },
        ],
      },
      { path: "analysis", element: <Analysis /> },
      { path: "encode", element: <Encoder /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalStyle />
    <ConfigProvider autoInsertSpaceInButton={false}>
      <RouterProvider router={router} />
    </ConfigProvider>
  </StrictMode>,
);
