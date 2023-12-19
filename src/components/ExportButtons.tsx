import { Button, Flex } from "antd";
import { useContext } from "react";
import { ConfigContext, DispatchContext } from "~/components/context";
import { load } from "js-yaml";
import type { Config } from "~/lib/config";
import { examples } from "~/lib/example";
import { Uploader, exportYAML } from "~/components/Utils";

export default function ExportButtons() {
  const config = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);
  const { source } = config;
  return (
    <Flex wrap="wrap" gap="small">
      <Uploader
        type="yaml"
        action={(s: string) => {
          dispatch({ type: "load", value: load(s) as Config });
        }}
      />
      <Button onClick={() => exportYAML(config, "config.yaml")}>导出</Button>
      {source && (
        <Button
          onClick={() => {
            dispatch({
              type: "load",
              value: examples[source],
            });
          }}
        >
          重置
        </Button>
      )}
    </Flex>
  );
}
