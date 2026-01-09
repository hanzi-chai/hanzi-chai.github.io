import { Button, Flex } from "antd";
import { configAtom, roundTestConfig, useAtom, validateConfig } from "~/atoms";
import { Config, exportYAML } from "~/lib";
import { examples } from "~/templates";
import { Uploader } from "./Utils";
import { load } from "js-yaml";

export default function ConfigManager() {
  const [config, setConfig] = useAtom(configAtom);
  const { source } = config;
  return (
    <Flex wrap="wrap" gap="small" justify="center">
      <Button onClick={() => validateConfig(config)}>校验</Button>
      <Button onClick={() => roundTestConfig(config)}>环行</Button>
      <Uploader text="替换" action={(s) => setConfig(load(s) as Config)} />
      <Button onClick={() => exportYAML(config, config.info?.name ?? "config")}>
        导出
      </Button>
      {source && (
        <Button onClick={() => setConfig(examples[source])}>重置</Button>
      )}
    </Flex>
  );
}
