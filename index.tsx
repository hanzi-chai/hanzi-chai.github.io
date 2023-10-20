import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createGlobalStyle } from "styled-components";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import HomeLayout from "./components/HomeLayout";
import EditorLayout from "./components/EditorLayout";
import Info from "./components/Info";
import Data, {
  ComponentData,
  CompoundData,
  CharacterData,
  SliceData,
} from "./components/Data";
import Elements, {
  PhoneticElementConfig,
  RootElementConfig,
} from "./components/Elements";
import Analysis from "./components/Analysis";
import Encoder from "./components/Encoder";
import Classifier from "./components/Classifier";
import { ConfigProvider } from "antd";

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

const router = createBrowserRouter([
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
          { path: "components", element: <ComponentData /> },
          { path: "compounds", element: <CompoundData /> },
          { path: "characters", element: <CharacterData /> },
          { path: "slices", element: <SliceData /> },
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
