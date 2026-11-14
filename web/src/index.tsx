import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router";
import { ConfigProvider, Skeleton } from "antd";
import ErrorResult from "./components/Error";
import AutoRoute from "~react-pages";
import { useHashRouter } from "./utils";
import { DevTools } from "jotai-devtools";
import 'jotai-devtools/styles.css';
import "./index.css";

const idpath = AutoRoute.find((v) => v.path === ":id");
idpath?.children?.forEach((v) => {
  v.errorElement = <ErrorResult />;
});

const createRouter = useHashRouter ? createHashRouter : createBrowserRouter;

const router = createRouter(AutoRoute);

createRoot(document.getElementById("root")!).render(
  <>
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
      <Suspense fallback={<Skeleton active />}>
        {/* <DevTools /> */}
        <RouterProvider router={router} />
      </Suspense>
    </ConfigProvider>
  </>,
);
