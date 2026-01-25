import { Button, Flex } from "antd";
import { 配置原子, 配置历史原子, useAtom } from "~/atoms";
import { UNDO, REDO } from "jotai-history";
import { type Example, examples } from "~/templates";
import { Uploader } from "./Utils";
import { load } from "js-yaml";
import { exportYAML, roundTestConfig, validateConfig } from "~/utils";
import type { 配置 } from "~/lib";

export default function ConfigManager() {
  const [config, setConfig] = useAtom(配置原子);
  const [history, setHistory] = useAtom(配置历史原子);
  const { source } = config;
  return (
    <Flex wrap="wrap" gap="small" justify="center">
      <Button onClick={() => validateConfig(config)}>校验</Button>
      <Button onClick={() => roundTestConfig(config)}>环行</Button>
      <Uploader text="替换" action={(s) => setConfig(load(s) as 配置)} />
      <Button onClick={() => exportYAML(config, config.info?.name ?? "config")}>
        导出
      </Button>
      {source && (
        <Button onClick={() => setConfig(examples[source as Example])}>
          重置
        </Button>
      )}
      <Button disabled={!history.canUndo} onClick={() => setHistory(UNDO)}>
        撤销
      </Button>
      <Button disabled={!history.canRedo} onClick={() => setHistory(REDO)}>
        重做
      </Button>
    </Flex>
  );
}
