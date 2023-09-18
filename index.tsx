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
import Data from "./components/Data";
import Rules from "./components/Rules";
import Roots from "./components/Roots";
import Result from "./components/Result";

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
      { path: "data", element: <Data /> },
      { path: "rule", element: <Rules /> },
      { path: "root", element: <Roots /> },
      { path: "result", element: <Result /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalStyle />
    <RouterProvider router={router} />
  </React.StrictMode>,
);
