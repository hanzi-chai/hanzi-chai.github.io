import { Button, Drawer } from "antd";
import React, { Suspense, useState } from "react";

const Content = React.lazy(() => import("./changelog.mdx"));

//#region ChangelogDrawer default component
export type ChangelogDrawerProps = {};
export default function ChangelogDrawer(_props: ChangelogDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="link" size="small" onClick={() => setOpen(true)}>
        更新历史
      </Button>
      <Drawer
        title="更新历史"
        onClose={() => setOpen(false)}
        closable
        destroyOnHidden
        placement="right"
        open={open}
      >
        <Suspense fallback="Loading...">
          <div className="prose">
            <Content />
          </div>
        </Suspense>
      </Drawer>
    </>
  );
}
//#endregion
