import { Button } from "antd";
import type { ComponentProps } from "react";

const Item = ({ className, type, ...props }: ComponentProps<typeof Button>) => (
  <Button
    type={type}
    className={`min-w-8 h-8! px-2! border-transparent! shadow-none ${type !== "primary" ? "bg-transparent!" : ""} ${className ?? ""}`}
    {...props}
  />
);

export default Item;
