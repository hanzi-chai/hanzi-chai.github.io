import useTitle from "ahooks/es/useTitle";

export function useChaifenTitle(title: string) {
  useTitle(`${title} · 汉字自动拆分系统 ${APP_VERSION}`, {
    restoreOnUnmount: true,
  });
}
