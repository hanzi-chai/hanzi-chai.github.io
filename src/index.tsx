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

const router = createRouter([
  {
    path: "/",
    async lazy() {
      const c = await import("./pages/HomeLayout");
      return { Component: c.default };
    },
  },
  {
    path: "/:id",
    async lazy() {
      const c = await import("./pages/EditorLayout");
      return { Component: c.default };
    },
    children: [
      {
        index: true,
        async lazy() {
          const c = await import("./pages/Info");
          return { Component: c.default };
        },
      },
      {
        path: "data",
        async lazy() {
          const c = await import("./pages/Data");
          return { Component: c.default };
        },
        children: [
          {
            path: "form",
            async lazy() {
              const c = await import("./pages/Form");
              return { Component: c.default };
            },
          },

          {
            path: "repertoire",
            async lazy() {
              const c = await import("./pages/Repertoire");
              return { Component: c.default };
            },
          },
          {
            path: "classifier",
            async lazy() {
              const c = await import("./pages/Classifier");
              return { Component: c.default };
            },
          },
        ],
      },
      {
        path: "element",
        async lazy() {
          const c = await import("./pages/Elements");
          return { Component: c.default };
        },
        children: [
          {
            path: "form",
            async lazy() {
              const c = await import("./pages/Elements");
              return { Component: c.RootElementConfig };
            },
          },
          {
            path: "pronunciation",
            async lazy() {
              const c = await import("./pages/Elements");
              return { Component: c.PhoneticElementConfig };
            },
          },
        ],
      },
      {
        path: "analysis",
        async lazy() {
          const c = await import("./pages/Analysis");
          return { Component: c.default };
        },
      },
      {
        path: "encode",
        async lazy() {
          const c = await import("./pages/Encoder");
          return { Component: c.default };
        },
      },
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
