import React from "react";
import ReactDOM from "react-dom/client";
import { createGlobalStyle } from "styled-components";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router-dom";
import HomeLayout from "./components/HomeLayout";
import EditorLayout from "./components/EditorLayout";
import Info from "./components/Info";
import Data, { ComponentData, CompoundData } from "./components/Data";
import Elements, { ElementConfig } from "./components/Elements";
import Analysis, { AnalysisDispatch } from "./components/Analysis";
import Encoder from "./components/Encoder";
import EditableTable from "./components/EditableTable";

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
  #root {
    display: flex;
    flex-direction: column;
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
          { path: "component", element: <ComponentData /> },
          { path: "compound", element: <CompoundData /> },
          { path: "character", element: <EditableTable /> },
        ],
      },
      {
        path: "element",
        element: <Elements />,
        children: [{ path: ":index", element: <ElementConfig /> }],
      },
      {
        path: "analysis",
        element: <Analysis />,
        children: [
          {
            path: ":index",
            element: <AnalysisDispatch />,
          },
        ],
      },
      { path: "encode", element: <Encoder /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalStyle />
    <RouterProvider router={router} />
  </React.StrictMode>,
);
