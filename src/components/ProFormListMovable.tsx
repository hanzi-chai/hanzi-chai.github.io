import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import type { ProFormListProps } from "@ant-design/pro-components";
import { ProFormList } from "@ant-design/pro-components";
import type { ReactNode } from "react";

export default function ProFormListMovable<T>({
  children,
  extraActions,
  ...props
}: ProFormListProps<T> & {
  extraActions?: ReactNode[];
}) {
  return (
    <ProFormList<T>
      {...props}
      actionRender={(field, action, defaultActionDom, count) => [
        ...defaultActionDom,
        <ArrowUpOutlined
          key="up_arrow"
          className="ml-1"
          onClick={() => {
            if (field.name === 0) {
              action.move(field.name, count - 1);
            } else {
              action.move(field.name, field.name - 1);
            }
          }}
        />,
        <ArrowDownOutlined
          key="down_arrow"
          className="ml-1"
          onClick={() => {
            if (field.name === count - 1) {
              action.move(field.name, 0);
            } else {
              action.move(field.name, field.name + 1);
            }
          }}
        />,
        ...(extraActions ?? []),
      ]}
    >
      {children}
    </ProFormList>
  );
}
