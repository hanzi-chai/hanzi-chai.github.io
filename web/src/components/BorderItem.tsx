import { Button } from "antd";
import { type ComponentProps, forwardRef } from "react";

const BorderItem = forwardRef<HTMLButtonElement, ComponentProps<typeof Button>>(
  ({ className, ...props }, ref) => (
    <Button
      ref={ref as any}
      className={`min-w-8! h-8! px-2! ${className ?? ""}`}
      {...props}
    />
  ),
) as typeof Button;

export default BorderItem;
