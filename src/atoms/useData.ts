import { useLocation } from "react-router-dom";
import type { Config } from "~/lib/config";
import type { Glyph, Character } from "~/lib/data";
import { addDataAtom, removeDataAtom } from "./data";
import { useSetAtom } from "jotai";

/**  从页面的路由推导出应该修改哪一组 data */
const useDataType = () => {
  const { pathname } = useLocation();
  return pathname.split("/")[3] as keyof Config["data"];
};

/** 添加（更新）一个键值对*/
export const useAdd = () => {
  const addData = useSetAtom(addDataAtom);
  const subtype = useDataType();
  return (key: string, value?: number | Glyph | Character) => {
    addData(subtype, key, value as any);
  };
};

/** 删除一个键值对 */
export const useRemove = () => {
  const removeData = useSetAtom(removeDataAtom);
  const subtype = useDataType();
  return (key: string) => {
    removeData(subtype, key);
  };
};
