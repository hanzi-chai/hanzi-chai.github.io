import { useLocation } from "react-router-dom";
import useTitle from "ahooks/es/useTitle";
import type { Config } from "~/lib/config";

export function useChaifenTitle(title: string) {
  useTitle(`${title} · 汉字自动拆分系统 ${APP_VERSION}`, {
    restoreOnUnmount: true,
  });
}

/** 从页面的路由推导出应该修改哪一组 data */
export function useDataType() {
  const { pathname } = useLocation();
  return pathname.split("/")[3] as keyof Config["data"];
}
