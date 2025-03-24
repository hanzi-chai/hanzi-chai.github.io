import React, { useState, useEffect, useRef, useReducer } from "react";
import * as A from "antd";
import * as atoms from "~/atoms";

//#region ChangelogDrawer default component
export type ChangelogDrawerProps = {};
export default function ChangelogDrawer(props: ChangelogDrawerProps) {
  const Content = React.lazy(() => import("./changelog.mdx"));
  const [open, setOpen] = useState(false);

  return (
    <>
      <A.Button type="link" size="small" onClick={() => setOpen(true)}>
        更新历史
      </A.Button>
      <A.Drawer
        title="更新历史"
        onClose={() => setOpen(false)}
        closable
        destroyOnClose
        placement="right"
        open={open}
      >
        <React.Suspense fallback="Loading...">
          <div className="prose">
            <Content />
          </div>
        </React.Suspense>
      </A.Drawer>
    </>
  );
}
//#endregion
