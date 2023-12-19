import { Button, Flex } from "antd";
import { configAtom, useAtom } from "~/atoms";
import { load } from "js-yaml";
import type { Config } from "~/lib/config";
import { examples } from "~/lib/example";
import { Uploader, exportYAML } from "~/components/Utils";

export default function ExportButtons() {
  const [config, setConfig] = useAtom(configAtom);
  const { source } = config;
  return (
    <Flex wrap="wrap" gap="small">
      <Uploader
        type="yaml"
        action={(s: string) => {
          setConfig(load(s) as Config);
        }}
      />
      <Button onClick={() => exportYAML(config, "config.yaml")}>导出</Button>
      {source && (
        <Button onClick={() => setConfig(examples[source])}>重置</Button>
      )}
    </Flex>
  );
}
