import { Outlet, useLocation, Navigate } from "react-router-dom";

export default function Data() {
  const { pathname } = useLocation();
  const shouldRedirect = pathname.split("/").length === 3;
  return shouldRedirect ? <Navigate replace to="form" /> : <Outlet />;
}
