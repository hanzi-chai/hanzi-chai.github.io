import { Layout } from "antd";
import { createContext, useContext, useEffect, useState } from "react";
import { get } from "~/lib/api";
import { preprocessForm } from "~/lib/utils";
import {
  loadForm,
  selectFormLoading,
  useAppDispatch,
  useAppSelector,
} from "~/components/store";
import { Outlet } from "react-router-dom";

const AdminLayout = () => {
  const loading = useAppSelector(selectFormLoading);
  const dispatch = useAppDispatch();

  useEffect(() => {
    get<any, undefined>("form/all").then((data) => {
      dispatch(loadForm(preprocessForm(data)));
    });
  }, []);

  return loading ? (
    <h1>loading...</h1>
  ) : (
    <Layout style={{ height: "100%" }}>
      <Outlet />
    </Layout>
  );
};

export default AdminLayout;
