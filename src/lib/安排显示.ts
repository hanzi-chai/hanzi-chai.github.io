/**
 * 根安排显示文本（智能选根核心与 UI 共用，保证轨迹/差异区/操作列表同一种写法）。
 * 口径与用户输入语法一致：借码位 =「目标 位」（位 1 起，如 2 2），位与位之间「，」分隔；
 * 整体归并 =「归并→目标」。内部 0 基下标格式（如 鼻'1）不许外泄到显示层。
 */
export type 可显示安排 =
  | string
  | { element: unknown }
  | (string | { element: unknown; index: number })[]
  | null
  | undefined;

export const 安排文本 = (安排: 可显示安排): string =>
  typeof 安排 === "string"
    ? 安排
    : 安排 && !Array.isArray(安排)
      ? `归并→${(安排 as { element: string }).element ?? ""}`
      : (安排 ?? [])
          .map((c) =>
            typeof c === "string"
              ? c
              : `${typeof c.element === "string" ? c.element : (c.element as { 获取名称?: () => string } | undefined)?.获取名称?.() ?? ""} ${c.index + 1}`,
          )
          .join("，");

/**
 * 根与安排的「根=目标 / 根=(逐位安排)」记法（用于轨迹与差异区标记，与用户输入语法一致）。
 * 整体归并只写目标（如 大=3），借码位写逐位安排并加括号（如 金=(q，鼻 2)）；
 * 内部「归并→」前缀在此去掉、分隔符统一为 =。差异区与轨迹共用同一写法。
 */
export const 根安排描述 = (根: string, 安排: 可显示安排): string => {
  const 文 = 安排文本(安排).replace(/^归并→/, "");
  return Array.isArray(安排) ? `${根}=(${文})` : `${根}=${文}`;
};
